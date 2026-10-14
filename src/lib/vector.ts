import { ChromaClient, Collection } from 'chromadb';
import { DefaultEmbeddingFunction } from '@chroma-core/default-embed';

/**
 * Complaint embeddings. No OpenAI key is needed: Chroma's default embedder
 * (all-MiniLM-L6-v2, 384 dimensions) runs locally. To use OpenAI text-embedding-3-small
 * (1536 dimensions) swap in @chroma-core/openai and re-index.
 */
let collectionPromise: Promise<Collection> | null = null;

export function getCollection(): Promise<Collection> {
  if (!collectionPromise) {
    const client = new ChromaClient({
      host: process.env.CHROMA_HOST ?? '127.0.0.1',
      port: Number(process.env.CHROMA_PORT ?? 8000),
      ssl: false,
    });
    collectionPromise = client
      .getOrCreateCollection({
        name: 'complaints',
        embeddingFunction: new DefaultEmbeddingFunction(),
        configuration: { hnsw: { space: 'cosine' } },
      })
      .catch((e) => {
        collectionPromise = null; // retry on next call
        throw e;
      });
  }
  return collectionPromise;
}

export async function upsertComplaints(items: { id: number; text: string; tripId: number }[]) {
  if (!items.length) return;
  const col = await getCollection();
  await col.upsert({
    ids: items.map((i) => String(i.id)),
    documents: items.map((i) => i.text),
    metadatas: items.map((i) => ({ tripId: i.tripId })),
  });
}

/** Returns complaint ids ranked by cosine similarity (1 = identical meaning). */
export async function searchComplaints(query: string, n = 5): Promise<{ id: number; similarity: number }[]> {
  const col = await getCollection();
  const res = await col.query({ queryTexts: [query], nResults: n });
  const ids = res.ids[0] ?? [];
  const dists = res.distances?.[0] ?? [];
  return ids.map((id, i) => ({ id: Number(id), similarity: Math.round((1 - (dists[i] ?? 1)) * 1000) / 1000 }));
}
