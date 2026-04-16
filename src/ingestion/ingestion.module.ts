import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';
import { VectorStoreModule } from '../vector-store/vector-store.module';

@Module({
  imports: [ConfigModule, VectorStoreModule],
  providers: [IngestionService],
  controllers: [IngestionController],
  exports: [IngestionService],
})
export class IngestionModule {}
