import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { IngestionModule } from './ingestion/ingestion.module';

@Module({
  imports: [ConfigModule.forRoot(), ChatModule, IngestionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
