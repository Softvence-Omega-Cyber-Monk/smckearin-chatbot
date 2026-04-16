import { Injectable, Logger } from '@nestjs/common';

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
}

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);
  private documents: VectorDocument[] = [];

  addDocuments(docs: VectorDocument[]): void {
    this.documents.push(...docs);
    this.logger.log(`Added ${docs.length} chunks. Total: ${this.documents.length}`);
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find top-k most similar documents to the query embedding
   */
  similaritySearch(queryEmbedding: number[], topK = 5): VectorDocument[] {
    if (this.documents.length === 0) {
      return [];
    }

    const scored = this.documents.map((doc) => ({
      doc,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => s.doc);
  }

  clearDocuments(): void {
    this.documents = [];
    this.logger.log('Vector store cleared');
  }

  getDocumentCount(): number {
    return this.documents.length;
  }

  getIndexedUrls(): string[] {
    const urls = new Set(this.documents.map((d) => d.metadata.url).filter(Boolean));
    return Array.from(urls);
  }
}
