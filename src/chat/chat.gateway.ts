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

  constructor(private readonly chatService: ChatService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connection', { data: 'Connected to chat server' });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  async handleMessage(client: Socket, payload: { message: string }) {
    this.logger.log(`Message from ${client.id}: ${payload.message}`);

    try {
      const conversationId = client.handshake.headers['x-conversation-id'] as string || client.id;
      
      // Send message to chatbot
      const result = await this.chatService.sendMessage(payload.message);

      // Emit response back to client
      client.emit('response', {
        conversationId: result.conversationId,
        message: result.message,
        response: result.response,
        timestamp: result.timestamp,
      });

      // Broadcast to all clients (optional)
      this.server.emit('newMessage', {
        conversationId: result.conversationId,
        message: result.message,
        response: result.response,
        timestamp: result.timestamp,
      });
    } catch (error) {
      this.logger.error(`Error handling message: ${error.message}`);
      client.emit('error', { message: 'Failed to process message' });
    }
  }

  @SubscribeMessage('getResponse')
  async handleGetResponse(client: Socket, payload: { conversationId: string }) {
    this.logger.log(`Get response for conversation: ${payload.conversationId}`);

    try {
      const result = this.chatService.getResponse(payload.conversationId);
      client.emit('conversationHistory', result);
    } catch (error) {
      this.logger.error(`Error getting response: ${error.message}`);
      client.emit('error', { message: 'Failed to retrieve conversation history' });
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket): string {
    this.logger.log(`Ping from ${client.id}`);
    return 'pong';
  }
}
