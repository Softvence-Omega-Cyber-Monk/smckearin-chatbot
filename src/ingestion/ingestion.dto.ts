import { IsUrl, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IngestUrlDto {
  @ApiProperty({ example: 'https://example.com/page', description: 'The URL to ingest content from' })
  @IsUrl()
  url: string;
}

export class IngestWebsiteDto {
  @ApiProperty({ example: 'https://example.com', description: 'The website URL to crawl' })
  @IsUrl()
  url: string;

  @ApiProperty({ example: 10, description: 'Maximum number of pages to crawl (1-50)', minimum: 1, maximum: 50, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxPages?: number;
}
