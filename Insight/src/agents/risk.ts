/**
 * Risk Agent (Tier 2 Evaluator)
 * Flags high-severity clusters and detects systemic issues.
 */
import type { Signal } from '@/types';

const RISK_PATTERNS = [
  { pattern: /support|response|ticket|help/i, risk: 'Systemic support failure creating churn risk' },
  { pattern: /price|pricing|cost|expensive|cheap|cheap/i, risk: 'Pricing model causing conversion friction' },
  { pattern: /bug|crash|broken|error|fail/i, risk: 'Product reliability issues reducing trust' },
  { pattern: /integrat|api|connect|sync/i, risk: 'Integration gaps blocking enterprise adoption' },
  { pattern: /onboard|setup|confus|difficult/i, risk: 'Onboarding friction increasing churn rate' },
  { pattern: /mobile|app|ios|android/i, risk: 'Mobile experience lagging desktop product parity' },
  { pattern: /data|export|lock|portab/i, risk: 'Data portability concerns creating lock-in backlash' },
  { pattern: /ai|artificial|gpt|llm/i, risk: 'AI feature disappointment eroding product credibility' },
];

export async function runRiskAgent(
  signals: Signal[],
  onProgress: (msg: string) => void,
): Promise<Signal[]> {
  onProgress('Risk Agent: Flagging high-severity systemic issues...');
  await new Promise(r => setTimeout(r, 150));

  const enriched = signals.map(signal => {
    const risks: string[] = [];
    const searchText = `${signal.label} ${signal.description} ${signal.posts.slice(0, 3).map(p => p.title).join(' ')}`;

    for (const { pattern, risk } of RISK_PATTERNS) {
      if (pattern.test(searchText)) risks.push(risk);
    }

    // Systemic detection: high volume + high negativity = systemic
    if (signal.volume >= 3 && signal.negativity >= 60) {
      risks.push('Pattern frequency suggests systemic product issue, not isolated incident');
    }
    if (signal.growthRate > 50) {
      risks.push('Rapidly accelerating complaint velocity — immediate attention required');
    }

    return {
      ...signal,
      risks: [...new Set(risks)],
      isRisk: risks.length > 0 || signal.severity === 'critical' || signal.severity === 'high',
    };
  });

  const riskCount = enriched.filter(s => s.isRisk).length;
  onProgress(`Risk Agent: Identified ${riskCount} risk signals ✓`);
  return enriched;
}
