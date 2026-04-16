import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { VectorStoreService, VectorDocument } from '../vector-store/vector-store.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface IngestResult {
  url: string;
  chunksCreated: number;
  pageTitle: string;
}

export interface QAIngestResult {
  qaPairsIngested: number;
  totalDocuments: number;
}

interface QAPair {
  category: string;
  question: string;
  answer: string;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly openai?: OpenAI;
  private readonly embeddingModel: string;
  private readonly CHUNK_SIZE = 500;   // characters per chunk
  private readonly CHUNK_OVERLAP = 100; // overlap between chunks

  constructor(
    private readonly configService: ConfigService,
    private readonly vectorStore: VectorStoreService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') || this.configService.get<string>('openai.apiKey');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
    this.embeddingModel = this.configService.get<string>('openai.embeddingModel') || 'text-embedding-3-small';
  }

  /**
   * Scrape a URL, chunk its text, embed each chunk, and store in vector store
   */
  async ingestUrl(url: string): Promise<IngestResult> {
    this.logger.log(`Ingesting URL: ${url}`);

    // 1. Fetch page
    const { text, title } = await this.fetchPage(url);

    // 2. Chunk text
    const chunks = this.chunkText(text);
    this.logger.log(`Created ${chunks.length} chunks from "${title}"`);

    // 3. Embed all chunks in batches
    const embeddings = await this.embedChunks(chunks);

    // 4. Build VectorDocuments
    const docs: VectorDocument[] = chunks.map((chunk, i) => ({
      id: uuidv4(),
      content: chunk,
      embedding: embeddings[i],
      metadata: { url, title, chunkIndex: i },
    }));

    // 5. Store
    this.vectorStore.addDocuments(docs);

    return { url, chunksCreated: docs.length, pageTitle: title };
  }

  /**
   * Crawl a website: ingest the root URL and all same-origin links found on it
   */
  async ingestWebsite(baseUrl: string, maxPages = 10): Promise<IngestResult[]> {
    const visited = new Set<string>();
    const queue: string[] = [baseUrl];
    const results: IngestResult[] = [];

    const origin = new URL(baseUrl).origin;

    while (queue.length > 0 && visited.size < maxPages) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);

      try {
        const result = await this.ingestUrl(url);
        results.push(result);

        // Discover more links on the same origin
        const links = await this.extractLinks(url, origin);
        for (const link of links) {
          if (!visited.has(link)) queue.push(link);
        }
      } catch (err) {
        this.logger.warn(`Failed to ingest ${url}: ${err.message}`);
      }
    }

    return results;
  }

  /**
   * Ingest Q&A data from a JSON file containing structured Q&A pairs
   */
  async ingestQAData(filePath?: string): Promise<QAIngestResult> {
    const dataPath = filePath || path.join(__dirname, '../data/qa-data.json');

    if (!fs.existsSync(dataPath)) {
      throw new Error(`Q&A data file not found at ${dataPath}`);
    }

    this.logger.log(`Ingesting Q&A data from ${dataPath}`);

    try {
      const fileContent = fs.readFileSync(dataPath, 'utf-8');
      const qaData = JSON.parse(fileContent);

      if (!qaData.qaPairs || !Array.isArray(qaData.qaPairs)) {
        throw new Error('Invalid Q&A data format. Expected qaPairs array.');
      }

      const qaPairs: QAPair[] = qaData.qaPairs;

      // Format Q&A pairs - combine question and answer for better search context
      const formattedContent = qaPairs.map((pair) => {
        return `Q: ${pair.question}\nA: ${pair.answer}\n[Category: ${pair.category}]`;
      });

      // Embed all Q&A pairs in batches
      const embeddings = await this.embedChunks(formattedContent);

      // Build VectorDocuments
      const docs: VectorDocument[] = formattedContent.map((content, i) => ({
        id: uuidv4(),
        content: content,
        embedding: embeddings[i],
        metadata: {
          source: 'qa-data',
          category: qaPairs[i].category,
          question: qaPairs[i].question,
          answer: qaPairs[i].answer,
        },
      }));

      // Store in vector store
      this.vectorStore.addDocuments(docs);

      this.logger.log(`Successfully ingested ${qaPairs.length} Q&A pairs`);

      return {
        qaPairsIngested: qaPairs.length,
        totalDocuments: this.vectorStore.getDocumentCount(),
      };
    } catch (error) {
      this.logger.error(`Failed to ingest Q&A data: ${error.message}`);
      throw error;
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async fetchPage(url: string): Promise<{ text: string; title: string }> {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (RAG-Bot/1.0)' },
      timeout: 10_000,
    });

    const $ = cheerio.load(response.data);

    // Remove noise
    $('script, style, nav, footer, header, aside, .cookie-banner, [aria-hidden="true"]').remove();

    const title = $('title').text().trim() || $('h1').first().text().trim() || url;
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    return { text, title };
  }

  private async extractLinks(url: string, origin: string): Promise<string[]> {
    try {
      const response = await axios.get(url, { timeout: 10_000 });
      const $ = cheerio.load(response.data);
      const links: string[] = [];

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return; // skip if href is empty
        try {
          const resolved = new URL(href, url).toString().split('#')[0]; // strip hash
          if (resolved.startsWith(origin)) links.push(resolved);
        } catch {
          // invalid URL — skip
        }
      });

      return [...new Set(links)];
    } catch {
      return [];
    }
  }

  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.CHUNK_SIZE, text.length);
      const chunk = text.slice(start, end).trim();
      if (chunk.length > 50) chunks.push(chunk); // skip tiny fragments
      start += this.CHUNK_SIZE - this.CHUNK_OVERLAP;
    }

    return chunks;
  }

  private async embedChunks(chunks: string[]): Promise<number[][]> {
    if (!this.openai) {
      throw new Error('OpenAI is not configured. Please set OPENAI_API_KEY environment variable.');
    }
    const BATCH = 100; // OpenAI allows up to 2048 inputs per request
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: batch,
      });
      allEmbeddings.push(...response.data.map((d) => d.embedding));
    }

    return allEmbeddings;
  }
}
