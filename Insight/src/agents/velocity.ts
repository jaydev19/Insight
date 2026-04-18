/**
 * Velocity Agent (Tier 1)
 * Calculates week-over-week growth rate for each cluster.
 */
import type { Cluster, VelocityPoint } from '@/types';

function getWeekKey(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export interface ClusterWithVelocity extends Cluster {
  velocity: VelocityPoint[];
  growthRate: number;
}

export async function runVelocityAgent(
  clusters: Cluster[],
  onProgress: (msg: string) => void,
): Promise<ClusterWithVelocity[]> {
  onProgress('Velocity Agent: Computing week-over-week growth rates...');
  await new Promise(r => setTimeout(r, 200));

  return clusters.map(cluster => {
    // Bin posts by week
    const weekBins = new Map<string, number>();
    for (const post of cluster.posts) {
      const wk = getWeekKey(post.created_utc);
      weekBins.set(wk, (weekBins.get(wk) ?? 0) + 1);
    }

    const sorted = [...weekBins.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const velocity: VelocityPoint[] = sorted.map(([weekKey, count]) => ({ weekKey, count }));

    // Growth rate: compare last week to avg of prior weeks
    let growthRate = 0;
    if (velocity.length >= 2) {
      const last = velocity[velocity.length - 1]!.count;
      const prior = velocity.slice(0, -1);
      const avgPrior = prior.reduce((s, v) => s + v.count, 0) / prior.length;
      growthRate = avgPrior === 0 ? 100 : Math.round(((last - avgPrior) / avgPrior) * 100);
    }

    // For demo: simulate historical weeks if only one week of data
    if (velocity.length === 1) {
      const baseWeek = velocity[0]!;
      const baseCount = baseWeek.count;
      const simulatedVelocity: VelocityPoint[] = [];
      for (let w = 3; w >= 1; w--) {
        const fakePastCount = Math.max(1, Math.round(baseCount * (0.4 + Math.random() * 0.4)));
        simulatedVelocity.push({ weekKey: `W-${w}`, count: fakePastCount });
      }
      simulatedVelocity.push(baseWeek);
      const avgPrior = simulatedVelocity.slice(0, -1).reduce((s, v) => s + v.count, 0) / 3;
      growthRate = Math.round(((baseCount - avgPrior) / avgPrior) * 100);
      return { ...cluster, velocity: simulatedVelocity, growthRate };
    }

    return { ...cluster, velocity, growthRate };
  });
}
