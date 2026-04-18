/**
 * Validation Agent (Tier 2 Evaluator)
 * Removes weak clusters, confirms frequency thresholds,
 * and marks signals as validated.
 */
import type { Signal } from '@/types';

const MIN_POSTS = 1;
const MIN_SCORE = 10;

export async function runValidationAgent(
  signals: Signal[],
  onProgress: (msg: string) => void,
): Promise<Signal[]> {
  onProgress('Validation Agent: Filtering and confirming signal thresholds...');
  await new Promise(r => setTimeout(r, 100));

  const validated = signals
    .filter(signal => signal.volume >= MIN_POSTS && signal.score >= MIN_SCORE)
    .map(signal => ({
      ...signal,
      validated: true,
    }));

  const removed = signals.length - validated.length;
  onProgress(`Validation Agent: ${validated.length} signals validated (${removed} filtered out) ✓`);
  return validated;
}
