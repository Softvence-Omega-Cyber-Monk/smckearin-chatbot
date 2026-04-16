import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

interface ConversationMessage {
  id: string;
  message: string;
  response: string;
  timestamp: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private conversations: Map<string, ConversationMessage[]> = new Map();
  private readonly openai?: OpenAI;
  private readonly embeddingModel: string;

  constructor(
    private readonly vectorStore: VectorStoreService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') || this.configService.get<string>('openai.apiKey');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
    this.embeddingModel = this.configService.get<string>('openai.embeddingModel') || 'text-embedding-3-small';
  }

  async sendMessage(message: string): Promise<{ conversationId: string; message: string; response: string; timestamp: string }> {
    const conversationId = uuidv4();
    const timestamp = new Date().toISOString();

    try {
      // Get response from chatbot using vector store
      const response = await this.generateResponse(message);

      // Store message in conversation history
      if (!this.conversations.has(conversationId)) {
        this.conversations.set(conversationId, []);
      }

      this.conversations.get(conversationId)!.push({
        id: uuidv4(),
        message,
        response,
        timestamp,
      });

      this.logger.log(`Message sent: ${message}`);

      return {
        conversationId,
        message,
        response,
        timestamp,
      };
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`);
      const fallbackResponse = this.getFallbackResponse(message);
      return {
        conversationId,
        message,
        response: fallbackResponse,
        timestamp,
      };
    }
  }

  getResponse(conversationId: string): { conversationId: string; messages: any[] } {
    const messages = this.conversations.get(conversationId) || [];

    return {
      conversationId,
      messages,
    };
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
