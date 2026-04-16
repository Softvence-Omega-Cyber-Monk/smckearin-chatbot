import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto, ChatResponseDto } from './chat.dto';

@Controller('chat')
@ApiTags('Chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  @ApiOperation({
    summary: 'Send a message to the chatbot',
    description: 'Send a message to the chatbot and get an immediate response',
  })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({
    status: 201,
    description: 'Message successfully sent and response received',
    type: ChatResponseDto,
    example: {
      conversationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      message: 'What is the weather today?',
      response: 'You said: "What is the weather today?". This is a mock response from the chatbot.',
      timestamp: '2024-04-15T17:20:00Z',
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  async sendMessage(@Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(dto.message);
  }

  @Get('response/:conversationId')
  @ApiOperation({
    summary: 'Get chatbot response',
    description: 'Retrieve the chatbot response for a specific conversation ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved conversation and responses',
    example: {
      conversationId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      messages: [
        {
          id: 'msg-1',
          message: 'What is the weather today?',
          response: 'You said: "What is the weather today?". This is a mock response from the chatbot.',
          timestamp: '2024-04-15T17:20:00Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getResponse(@Param('conversationId') conversationId: string) {
    return this.chatService.getResponse(conversationId);
  }
}
