import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { IngestUrlDto, IngestWebsiteDto } from './ingestion.dto';

@Controller('ingest')
export class IngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  @Post('url')
  async ingestUrl(@Body() dto: IngestUrlDto) {
    const result = await this.ingestionService.ingestUrl(dto.url);
    return { success: true, ...result };
  }

  @Post('website')
  async ingestWebsite(@Body() dto: IngestWebsiteDto) {
    const results = await this.ingestionService.ingestWebsite(
      dto.url,
      dto.maxPages ?? 10,
    );
    const totalChunks = results.reduce((s, r) => s + r.chunksCreated, 0);
    return { success: true, pagesIngested: results.length, totalChunks, pages: results };
  }

  @Post('qa-data')
  async ingestQAData() {
    const result = await this.ingestionService.ingestQAData();
    return { success: true, ...result };
  }

  @Get('status')
  status() {
    return {
      totalChunks: this.vectorStore.getDocumentCount(),
      indexedUrls: this.vectorStore.getIndexedUrls(),
    };
  }

  @Delete('clear')
  clear() {
    this.vectorStore.clearDocuments();
    return { success: true, message: 'Vector store cleared' };
  }
}
