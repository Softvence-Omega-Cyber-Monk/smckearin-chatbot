import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'What is the weather today?', description: 'The message to send to the bot' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ChatResponseDto {
  @ApiProperty({ example: 'user-123', description: 'The conversation ID' })
  conversationId: string;

  @ApiProperty({ example: 'What is the weather today?', description: 'The user message' })
  message: string;

  @ApiProperty({ example: 'I don\'t have access to real-time weather data...', description: 'The bot response' })
  response: string;

  @ApiProperty({ example: '2024-04-15T17:20:00Z', description: 'Timestamp of the response' })
  timestamp: string;
}
