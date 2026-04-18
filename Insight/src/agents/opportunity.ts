/**
 * Opportunity Agent (Tier 2 Evaluator)
 * Identifies unmet needs and repeated feature requests from pain signals.
 */
import type { Signal } from '@/types';

const OPPORTUNITY_PATTERNS = [
  { pattern: /support|response|ticket/i, opp: 'Build AI-powered instant support with knowledge base integration' },
  { pattern: /onboard|setup|learn|confus/i, opp: 'Interactive onboarding wizard with personalized user journey' },
  { pattern: /price|pricing|cost|transparent/i, opp: 'Self-serve pricing calculator with transparent tier comparison' },
  { pattern: /integrat|api|connect|zapier/i, opp: 'Native integration marketplace with no-code connectors' },
  { pattern: /mobile|app|phone/i, opp: 'Mobile-first product redesign with feature parity' },
  { pattern: /data|export|portab/i, opp: 'One-click data export in multiple formats as standard feature' },
  { pattern: /ai|artificial|search/i, opp: 'Reliable AI features with clear capability boundaries and user trust' },
  { pattern: /trial|demo|evaluat/i, opp: 'Frictionless 30-day trial with no credit card required' },
  { pattern: /email|notif|overwhelm/i, opp: 'Smart notification system with user-controlled frequency preferences' },
];

export async function runOpportunityAgent(
  signals: Signal[],
  onProgress: (msg: string) => void,
): Promise<Signal[]> {
  onProgress('Opportunity Agent: Identifying unmet needs and feature gaps...');
  await new Promise(r => setTimeout(r, 150));

  const enriched = signals.map(signal => {
    const opportunities: string[] = [];
    const searchText = `${signal.label} ${signal.description} ${signal.posts.slice(0, 5).map(p => p.title).join(' ')}`;

    for (const { pattern, opp } of OPPORTUNITY_PATTERNS) {
      if (pattern.test(searchText)) opportunities.push(opp);
    }

    // High negativity + high volume = validated market gap
    if (signal.negativity >= 70 && signal.volume >= 3) {
      opportunities.push('High pain × high frequency = validated unmet market need ready for product investment');
    }

    return {
      ...signal,
      opportunities: [...new Set(opportunities)],
      isOpportunity: opportunities.length > 0,
    };
  });

  const oppCount = enriched.filter(s => s.isOpportunity).length;
  onProgress(`Opportunity Agent: Found ${oppCount} opportunity signals ✓`);
  return enriched;
}
