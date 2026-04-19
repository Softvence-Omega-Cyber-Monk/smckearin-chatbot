import { Body, Controller, Get, Param, Post, BadRequestException, NotFoundException, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto, ChatResponseDto, ConversationHistoryDto } from './chat.dto';

@Controller('chat')
@ApiTags('Chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  @ApiOperation({
    summary: 'Send a message to the chatbot',
    description: 'Send a message to the chatbot and get an immediate response. Optionally pass a conversationId and userId to maintain conversation history.',
  })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({
    status: 201,
    description: 'Message successfully sent and response received',
    type: ChatResponseDto,
    example: {
      conversationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      userId: 'user-123',
      message: 'What is the weather today?',
      response: 'You said: "What is the weather today?". This is a mock response from the chatbot.',
      timestamp: '2024-04-15T17:20:00Z',
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  async sendMessage(@Body() dto: SendMessageDto) {
    if (!dto.message || dto.message.trim().length === 0) {
      throw new BadRequestException('Message cannot be empty');
    }
    return this.chatService.sendMessage(dto.message, dto.conversationId, dto.userId);
  }

  @Get('history/:conversationId')
  @ApiOperation({
    summary: 'Get conversation history',
    description: 'Retrieve the conversation history for a specific conversation ID. Optionally filter by userId.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved conversation history',
    type: ConversationHistoryDto,
    example: {
      conversationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      createdAt: '2024-04-15T17:20:00Z',
      messages: [
        {
          id: 'msg-1',
          userId: 'user-123',
          message: 'What is the weather today?',
          response: 'You said: "What is the weather today?". This is a mock response from the chatbot.',
          timestamp: '2024-04-15T17:20:00Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getHistory(
    @Param('conversationId') conversationId: string,
    @Query('userId') userId?: string,
  ) {
    if (!conversationId) {
      throw new BadRequestException('Conversation ID is required');
    }
    
    const result = this.chatService.getConversationHistory(conversationId, userId);
    
    if (!result) {
      throw new NotFoundException(`Conversation with ID ${conversationId} not found`);
    }
    
    return result;
  }
}

