/**
 * Cluster Agent (Tier 1)
 * Groups posts by topical similarity using TF-IDF + cosine similarity.
 * Adapted from World Monitor's analysis.worker.ts Jaccard approach,
 * extended with TF-IDF term weighting for better topic separation.
 */
import type { ProcessedPost, Cluster } from '@/types';

function tokenize(text: string): string[] {
  const stopwords = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with','is',
    'are','was','were','be','been','being','have','has','had','do','does','did',
    'will','would','could','should','may','might','can','this','that','these',
    'those','i','we','you','he','she','it','they','my','our','your','his','her',
    'its','their','what','which','who','how','when','where','why','all','any',
    'both','each','few','more','most','other','some','such','no','nor','not',
    'only','own','same','so','than','too','very','just','as','if','about','after',
    'before','up','out','from','there','here','get','got','also','even','still',
    'back','then','now','like','well','into','use','make','made','want','need',
    'much','many','every','am',
  ]);
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !stopwords.has(t));
}

function buildTfIdf(docs: string[][]): Map<string, number[]> {
  const termDf = new Map<string, number>();
  for (const doc of docs) {
    const seen = new Set(doc);
    for (const term of seen) termDf.set(term, (termDf.get(term) ?? 0) + 1);
  }
  const N = docs.length;
  const tfidf = new Map<string, number[]>();

  docs.forEach((doc, i) => {
    const tf = new Map<string, number>();
    for (const term of doc) tf.set(term, (tf.get(term) ?? 0) + 1);

    for (const [term, count] of tf) {
      const tfScore = count / doc.length;
      const idf = Math.log(N / ((termDf.get(term) ?? 1) + 1)) + 1;
      const score = tfScore * idf;
      if (!tfidf.has(term)) tfidf.set(term, new Array(N).fill(0));
      tfidf.get(term)![i] = score;
    }
  });

  return tfidf;
}

function getDocVector(docIndex: number, tfidf: Map<string, number[]>): Map<string, number> {
  const vec = new Map<string, number>();
  for (const [term, scores] of tfidf) {
    if (scores[docIndex]! > 0) vec.set(term, scores[docIndex]!);
  }
  return vec;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, normA = 0, normB = 0;
  for (const [term, aVal] of a) {
    dot += aVal * (b.get(term) ?? 0);
    normA += aVal * aVal;
  }
  for (const bVal of b.values()) normB += bVal * bVal;
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function getTopTerms(tokens: string[], n: number): string[] {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
}

export async function runClusterAgent(
  posts: ProcessedPost[],
  onProgress: (msg: string) => void,
): Promise<Cluster[]> {
  onProgress('Cluster Agent: Computing TF-IDF vectors...');
  await new Promise(r => setTimeout(r, 400));

  if (posts.length === 0) return [];

  const tokenized = posts.map(p => tokenize(p.cleanText));
  const tfidf = buildTfIdf(tokenized);
  const vectors = posts.map((_, i) => getDocVector(i, tfidf));

  const THRESHOLD = 0.18;
  const assigned = new Set<number>();
  const rawClusters: number[][] = [];

  for (let i = 0; i < posts.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = [i];
    assigned.add(i);
    for (let j = i + 1; j < posts.length; j++) {
      if (assigned.has(j)) continue;
      const sim = cosineSimilarity(vectors[i]!, vectors[j]!);
      if (sim >= THRESHOLD) {
        cluster.push(j);
        assigned.add(j);
      }
    }
    rawClusters.push(cluster);
  }

  onProgress(`Cluster Agent: Formed ${rawClusters.length} raw clusters, building signals...`);
  await new Promise(r => setTimeout(r, 200));

  const clusters: Cluster[] = rawClusters
    .filter(c => c.length >= 1)
    .sort((a, b) => b.length - a.length)
    .slice(0, 12) // Top 12 clusters
    .map((indices, idx) => {
      const clusterPosts = indices.map(i => posts[i]!);
      const allTokens = clusterPosts.flatMap(p => tokenize(p.cleanText));
      const topTerms = getTopTerms(allTokens, 5);
      const label = topTerms.slice(0, 3).join(' / ') || `Topic ${idx + 1}`;
      const centroidText = clusterPosts[0]?.title ?? label;

      const avgSentiment = clusterPosts.reduce((s, p) => s + p.sentimentScore, 0) / clusterPosts.length;
      const negativePosts = clusterPosts.filter(p => p.sentimentLabel === 'negative');
      const negativity = Math.round((negativePosts.length / clusterPosts.length) * 100);
      const subreddits = [...new Set(clusterPosts.map(p => p.subreddit))];
      const timestamps = clusterPosts.map(p => p.created_utc);

      return {
        id: `cluster-${idx}`,
        label,
        posts: clusterPosts,
        centroidText,
        volume: clusterPosts.length,
        avgSentiment: Math.round(avgSentiment),
        negativity,
        subreddits,
        firstSeen: Math.min(...timestamps),
        lastSeen: Math.max(...timestamps),
      };
    });

  onProgress(`Cluster Agent: ${clusters.length} topic clusters identified ✓`);
  return clusters;
}
