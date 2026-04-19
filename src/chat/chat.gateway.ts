import { WebSocketGateway, SubscribeMessage, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private clientConversations: Map<string, { conversationId: string; userId: string }> = new Map();

  constructor(private readonly chatService: ChatService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    // Try to get conversation ID and user ID from headers
    const conversationId = client.handshake.headers['x-conversation-id'] as string;
    const userId = client.handshake.headers['x-user-id'] as string || client.id;
    
    if (conversationId) {
      this.clientConversations.set(client.id, { conversationId, userId });
      this.logger.log(`Client connected: ${client.id} with conversation: ${conversationId}, user: ${userId}`);
    } else {
      this.logger.log(`Client connected: ${client.id}, user: ${userId}`);
    }
    
    client.emit('connection', { data: 'Connected to chat server', clientId: client.id, userId });
  }

  handleDisconnect(client: Socket) {
    const clientData = this.clientConversations.get(client.id);
    this.clientConversations.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}${clientData ? ` (conversation: ${clientData.conversationId}, user: ${clientData.userId})` : ''}`); 
  }

  @SubscribeMessage('message')
  async handleMessage(client: Socket, payload: { message: string; conversationId?: string; userId?: string }) {
    try {
      // Use provided values or get from client mapping
      const clientData = this.clientConversations.get(client.id);
      const conversationId = payload.conversationId || clientData?.conversationId;
      const userId = payload.userId || clientData?.userId || client.id;
      
      this.logger.log(`Message from ${client.id}: ${payload.message}${conversationId ? ` (Conversation: ${conversationId}, User: ${userId})` : ''}`); 

      // Send message to chatbot with conversationId and userId
      const result = await this.chatService.sendMessage(payload.message, conversationId, userId);

      // Store the conversation ID and userId for this client if it was generated
      if (!this.clientConversations.has(client.id)) {
        this.clientConversations.set(client.id, { conversationId: result.conversationId, userId: result.userId });
      }

      // Emit response back to client
      client.emit('response', {
        conversationId: result.conversationId,
        userId: result.userId,
        message: result.message,
        response: result.response,
        timestamp: result.timestamp,
      });
    } catch (error) {
      this.logger.error(`Error handling message: ${error.message}`);
      client.emit('error', { message: 'Failed to process message' });
    }
  }

  @SubscribeMessage('getHistory')
  async handleGetHistory(client: Socket, payload: { conversationId: string; userId?: string }) {
    try {
      const userId = payload.userId;
      this.logger.log(`Get history for conversation: ${payload.conversationId}${userId ? `, user: ${userId}` : ''}`);

      const conversation = this.chatService.getConversationHistory(payload.conversationId, userId);
      
      if (!conversation) {
        client.emit('error', { message: 'Conversation not found' });
        return;
      }

      client.emit('conversationHistory', conversation);
    } catch (error) {
      this.logger.error(`Error getting history: ${error.message}`);
      client.emit('error', { message: 'Failed to retrieve conversation history' });
    }
  }

  @SubscribeMessage('startConversation')
  handleStartConversation(client: Socket, payload?: { conversationId?: string; userId?: string }) {
    const conversationId = payload?.conversationId;
    const userId = payload?.userId || client.id;
    
    if (conversationId) {
      this.clientConversations.set(client.id, { conversationId, userId });
      this.logger.log(`Client ${client.id} started conversation: ${conversationId}, user: ${userId}`);
    }
    
    const stored = this.clientConversations.get(client.id);
    client.emit('conversationStarted', { 
      clientId: client.id,
      conversationId: conversationId || stored?.conversationId || 'pending',
      userId: userId,
    });
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket): string {
    this.logger.log(`Ping from ${client.id}`);
    return 'pong';
  }
}
