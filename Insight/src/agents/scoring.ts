/**
 * Scoring Agent (Tier 1)
 * Computes the SignalScore formula from the SRS:
 * SignalScore = (VolumeWeight * normVolume) + (SentimentWeight * negativity) + (VelocityWeight * growthRate)
 */
import type { Signal } from '@/types';
import type { ClusterWithVelocity } from './velocity';

const VOLUME_WEIGHT = 0.35;
const SENTIMENT_WEIGHT = 0.40;
const VELOCITY_WEIGHT = 0.25;

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function getSeverity(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export async function runScoringAgent(
  clusters: ClusterWithVelocity[],
  onProgress: (msg: string) => void,
): Promise<Signal[]> {
  onProgress('Scoring Agent: Computing signal scores...');
  await new Promise(r => setTimeout(r, 200));

  if (clusters.length === 0) return [];

  const volumes = clusters.map(c => c.volume);
  const minVol = Math.min(...volumes);
  const maxVol = Math.max(...volumes);

  const growthRates = clusters.map(c => Math.max(0, c.growthRate));
  const minGrowth = 0;
  const maxGrowth = Math.max(...growthRates, 1);

  const signals: Signal[] = clusters.map((cluster, idx) => {
    const normVolume = normalize(cluster.volume, minVol, maxVol);
    const negativity = cluster.negativity / 100;
    const normGrowth = normalize(Math.max(0, cluster.growthRate), minGrowth, maxGrowth);

    const rawScore =
      (VOLUME_WEIGHT * normVolume * 100) +
      (SENTIMENT_WEIGHT * negativity * 100) +
      (VELOCITY_WEIGHT * normGrowth * 100);

    const score = Math.round(Math.min(100, rawScore));
    const severity = getSeverity(score);

    return {
      id: `signal-${idx}`,
      clusterId: cluster.id,
      label: cluster.label,
      description: cluster.centroidText,
      score,
      severity,
      volume: cluster.volume,
      negativity: cluster.negativity,
      growthRate: cluster.growthRate,
      velocity: cluster.velocity,
      risks: [],
      opportunities: [],
      isRisk: false,
      isOpportunity: false,
      validated: false,
      posts: cluster.posts,
    };
  });

  const sorted = signals.sort((a, b) => b.score - a.score);
  onProgress(`Scoring Agent: Ranked ${sorted.length} signals ✓`);
  return sorted;
}
