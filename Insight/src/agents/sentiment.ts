/**
 * Sentiment Agent (Tier 1)
 * Applies rule-based + lexicon sentiment scoring to each post.
 * Outputs a normalized score from -100 (most negative) to +100 (most positive).
 * 
 * For the prototype we use a lightweight lexicon-based approach so it works
 * entirely in the browser without requiring a model download.
 * The ml.worker.ts ONNX approach can be swapped in for production.
 */
import type { RedditPost, ProcessedPost } from '@/types';

const NEGATIVE_TERMS = [
  'terrible', 'broken', 'worst', 'useless', 'awful', 'hate', 'frustrated', 'angry',
  'disappointed', 'wrong', 'bad', 'fail', 'fails', 'failed', 'failure', 'disaster',
  'impossible', 'annoying', 'painful', 'nightmare', 'ridiculous', 'unacceptable',
  'confusing', 'slow', 'crash', 'bug', 'issue', 'problem', 'poor', 'lacking',
  'missing', 'broken', 'garbage', 'trash', 'waste', 'outrage', 'scam', 'locked',
  'hidden', 'gimmick', 'useless', 'unhelpful', 'overwhelming', 'exhausting',
];

const POSITIVE_TERMS = [
  'great', 'excellent', 'love', 'amazing', 'fantastic', 'perfect', 'wonderful',
  'helpful', 'easy', 'simple', 'intuitive', 'fast', 'reliable', 'solid',
  'recommend', 'impressed', 'delighted', 'smooth', 'clean', 'best',
];

const INTENSIFIERS = ['very', 'extremely', 'really', 'absolutely', 'completely', 'totally'];
const NEGATORS = ['not', 'no', 'never', 'nothing', 'neither', "don't", "doesn't", "can't", "won't"];

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(Boolean);
}

function scoreLexicon(tokens: string[]): number {
  let score = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const prevToken = tokens[i - 1] ?? '';
    const prev2Token = tokens[i - 2] ?? '';
    const isNegated = NEGATORS.includes(prevToken) || NEGATORS.includes(prev2Token);
    const isIntensified = INTENSIFIERS.includes(prevToken) ? 1.5 : 1;

    if (NEGATIVE_TERMS.includes(token)) {
      score += isNegated ? +15 : (-20 * isIntensified);
    } else if (POSITIVE_TERMS.includes(token)) {
      score += isNegated ? -15 : (20 * isIntensified);
    }
  }
  return Math.max(-100, Math.min(100, score));
}

function getWeekKey(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function runSentimentAgent(
  posts: RedditPost[],
  onProgress: (msg: string) => void,
): Promise<ProcessedPost[]> {
  onProgress('Sentiment Agent: Scoring post sentiment...');
  await new Promise(r => setTimeout(r, 300));

  const processed: ProcessedPost[] = posts.map(post => {
    const fullText = `${post.title} ${post.selftext}`;
    const tokens = tokenize(fullText);
    let rawScore = scoreLexicon(tokens);

    // Boost negativity signal from upvote ratio (highly-upvoted complaints = strong signal)
    if (rawScore < 0 && post.upvote_ratio > 0.9) {
      rawScore = Math.max(-100, rawScore * 1.2);
    }

    const sentimentScore = Math.round(rawScore);
    const sentimentLabel: 'positive' | 'negative' | 'neutral' =
      sentimentScore > 15 ? 'positive' : sentimentScore < -15 ? 'negative' : 'neutral';

    return {
      ...post,
      cleanText: fullText.trim(),
      sentimentScore,
      sentimentLabel,
      weekKey: getWeekKey(post.created_utc),
    };
  });

  const negCount = processed.filter(p => p.sentimentLabel === 'negative').length;
  onProgress(`Sentiment Agent: Scored ${posts.length} posts (${negCount} negative signals) ✓`);
  return processed;
}
