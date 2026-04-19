import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'What is the weather today?', description: 'The message to send to the bot' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Optional conversation ID for maintaining chat history', required: false })
  @IsString()
  @IsOptional()
  conversationId?: string;

  @ApiProperty({ example: 'user-123', description: 'Optional user ID to track messages by user', required: false })
  @IsString()
  @IsOptional()
  userId?: string;
}

export class ChatResponseDto {
  @ApiProperty({ example: 'user-123', description: 'The user ID' })
  userId: string;

  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'The conversation ID' })
  conversationId: string;

  @ApiProperty({ example: 'What is the weather today?', description: 'The user message' })
  message: string;

  @ApiProperty({ example: 'I don\'t have access to real-time weather data...', description: 'The bot response' })
  response: string;

  @ApiProperty({ example: '2024-04-15T17:20:00Z', description: 'Timestamp of the response' })
  timestamp: string;
}

export class ConversationHistoryDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'The conversation ID' })
  conversationId: string;

  @ApiProperty({ example: '2024-04-15T17:20:00Z', description: 'When the conversation was created' })
  createdAt: string;

  @ApiProperty({ 
    example: [{ id: 'msg-1', userId: 'user-123', message: 'Hello', response: 'Hi there!', timestamp: '2024-04-15T17:20:00Z' }],
    description: 'Array of messages in the conversation' 
  })
  messages: Array<{
    id: string;
    userId: string;
    message: string;
    response: string;
    timestamp: string;
  }>;
}
