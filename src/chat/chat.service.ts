import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

export interface ConversationMessage {
  id: string;
  userId: string;
  message: string;
  response: string;
  timestamp: string;
}

interface ConversationData {
  conversationId: string;
  createdAt: string;
  messages: ConversationMessage[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openai?: OpenAI;
  private readonly embeddingModel: string;
  private readonly conversationsDir: string;

  constructor(
    private readonly vectorStore: VectorStoreService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') || this.configService.get<string>('openai.apiKey');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
    this.embeddingModel = this.configService.get<string>('openai.embeddingModel') || 'text-embedding-3-small';
    
    // Initialize conversations directory for persistent storage
    this.conversationsDir = path.join(process.cwd(), 'conversations');
    if (!fs.existsSync(this.conversationsDir)) {
      fs.mkdirSync(this.conversationsDir, { recursive: true });
      this.logger.log(`Created conversations directory at ${this.conversationsDir}`);
    }
  }

  async sendMessage(message: string, conversationId?: string, userId?: string): Promise<{ conversationId: string; userId: string; message: string; response: string; timestamp: string }> {
    const finalConversationId = conversationId || uuidv4();
    const finalUserId = userId || 'anonymous';
    const timestamp = new Date().toISOString();

    try {
      // Get response from chatbot using vector store
      const response = await this.generateResponse(message);

      // Store message in conversation history
      const conversationData = this.loadConversation(finalConversationId);
      conversationData.messages.push({
        id: uuidv4(),
        userId: finalUserId,
        message,
        response,
        timestamp,
      });

      this.saveConversation(finalConversationId, conversationData);
      this.logger.log(`Message sent: ${message} (Conversation: ${finalConversationId}, User: ${finalUserId})`);

      return {
        conversationId: finalConversationId,
        userId: finalUserId,
        message,
        response,
        timestamp,
      };
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`);
      const fallbackResponse = this.getFallbackResponse(message);
      
      // Still store the fallback response
      const conversationData = this.loadConversation(finalConversationId);
      conversationData.messages.push({
        id: uuidv4(),
        userId: finalUserId,
        message,
        response: fallbackResponse,
        timestamp,
      });
      this.saveConversation(finalConversationId, conversationData);

      return {
        conversationId: finalConversationId,
        userId: finalUserId,
        message,
        response: fallbackResponse,
        timestamp,
      };
    }
  }

  getConversationHistory(conversationId: string, userId?: string): { conversationId: string; createdAt: string; messages: ConversationMessage[] } | null {
    try {
      const conversationPath = path.join(this.conversationsDir, `${conversationId}.json`);
      if (!fs.existsSync(conversationPath)) {
        this.logger.warn(`Conversation not found: ${conversationId}`);
        return null;
      }

      const data = fs.readFileSync(conversationPath, 'utf-8');
      const conversation: ConversationData = JSON.parse(data);
      
      // Filter messages by userId if provided
      const filteredMessages = userId 
        ? conversation.messages.filter(msg => msg.userId === userId)
        : conversation.messages;

      return {
        conversationId: conversation.conversationId,
        createdAt: conversation.createdAt,
        messages: filteredMessages,
      };
    } catch (error) {
      this.logger.error(`Error loading conversation ${conversationId}: ${error.message}`);
      return null;
    }
  }

  private loadConversation(conversationId: string): ConversationData {
    try {
      const conversationPath = path.join(this.conversationsDir, `${conversationId}.json`);
      
      if (fs.existsSync(conversationPath)) {
        const data = fs.readFileSync(conversationPath, 'utf-8');
        return JSON.parse(data);
      }

      // Create new conversation
      return {
        conversationId,
        createdAt: new Date().toISOString(),
        messages: [],
      };
    } catch (error) {
      this.logger.error(`Error loading conversation ${conversationId}: ${error.message}`);
      return {
        conversationId,
        createdAt: new Date().toISOString(),
        messages: [],
      };
    }
  }

  private saveConversation(conversationId: string, data: ConversationData): void {
    try {
      const conversationPath = path.join(this.conversationsDir, `${conversationId}.json`);
      fs.writeFileSync(conversationPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error(`Error saving conversation ${conversationId}: ${error.message}`);
    }
  }

  private async generateResponse(message: string): Promise<string> {
    // Step 1: Embed the user message
    if (!this.openai) {
      return this.getFallbackResponse(message);
    }

    const embeddingResponse = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: message,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Step 2: Search vector store for relevant context
    const relevantDocs = this.vectorStore.similaritySearch(queryEmbedding, 5);

    // Step 3: Build context from relevant documents
    let context = '';
    if (relevantDocs.length > 0) {
      context = 'Here is relevant information from the knowledge base:\n\n';
      relevantDocs.forEach((doc, index) => {
        context += `[Source: ${doc.metadata.title || doc.metadata.url}]\n${doc.content}\n\n`;
      });
    } else {
      context = 'No relevant documents found in the knowledge base. ';
    }

    // Step 4: Generate response using GPT
    const chatResponse = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a friendly and helpful assistant for Rescue Transit, a platform that connects shelters, fosters, and volunteer drivers to transport animals in need.

Your role is to help users understand how Rescue Transit works and answer questions about becoming a foster, volunteering as a driver, or posting animals for transport.

Use the provided knowledge base to answer questions accurately. If you're unsure about medical advice, approval status, or specific placement decisions, direct users to contact the shelter or support team at smckearin@gmail.com.

Be conversational, empathetic, and helpful.`,
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nUser question: ${message}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return chatResponse.choices[0].message.content || this.getFallbackResponse(message);
  }

  private getFallbackResponse(message: string): string {
    // Fallback response when OpenAI is not available
    return `Hello! You asked: "${message}". This is a fallback response. 
Please configure your OpenAI API key to get intelligent responses based on your knowledge base.`;
  }
}
