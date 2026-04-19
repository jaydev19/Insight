/**
 * Insight Agent (Tier 3 — Hybrid AI)
 * Reads structured memory, connects related signals, produces strategic insights.
 * 
 * If LLM is enabled (OpenAI/Anthropic API key provided), calls the API.
 * Otherwise falls back to deterministic rule-based insight templates.
 * 
 * This mirrors World Monitor's server/_shared/llm.ts pattern.
 */
import type { Signal, ExecutiveSummary, StrategicInsight, WorkspaceConfig } from '@/types';

// ── Rule-based fallback insight generator ─────────────────────────────────

function buildRuleBasedInsights(signals: Signal[], config: WorkspaceConfig): ExecutiveSummary {
  const critical = signals.filter(s => s.severity === 'critical');
  const high = signals.filter(s => s.severity === 'high');
  const opportunities = signals.filter(s => s.isOpportunity);
  const topSignal = signals[0];
  const topOpp = opportunities.sort((a, b) => b.score - a.score)[0];

  const insightTemplates: StrategicInsight[] = [];

  // Insight 1: Top pain cluster
  if (topSignal) {
    insightTemplates.push({
      id: 'insight-1',
      title: `Critical UX Pain: "${topSignal.label}"`,
      body: `The "${topSignal.label}" cluster has emerged as the highest-priority signal with a score of ${topSignal.score}/100. ` +
        `With ${topSignal.volume} posts and ${topSignal.negativity}% negativity rate, this represents a validated systemic pain point ` +
        `in your ${config.industry} target market. ` +
        (topSignal.growthRate > 0
          ? `The ${topSignal.growthRate}% week-over-week growth rate indicates this pain is actively worsening — prioritize immediately.`
          : `This pain appears stable but persistent — a product investment here would provide immediate differentiation.`),
      relatedSignals: [topSignal.id],
      confidence: 'high',
      type: 'risk',
    });
  }

  // Insight 2: Cross-cluster pattern
  if (critical.length + high.length >= 2) {
    const crossSignals = [...critical, ...high].slice(0, 3);
    const crossLabels = crossSignals.map(s => `"${s.label}"`).join(', ');
    insightTemplates.push({
      id: 'insight-2',
      title: 'Converging Pain Signals Indicate Product-Market Misalignment',
      body: `Multiple high-severity signals (${crossLabels}) share a common root: ` +
        `users are not getting the value they were promised at the point of sale. ` +
        `The pattern across ${crossSignals.reduce((s, c) => s + c.volume, 0)} posts suggests ` +
        `a fundamental gap between marketing messaging and product experience. ` +
        `Consider auditing the entire post-signup journey against user expectations.`,
      relatedSignals: crossSignals.map(s => s.id),
      confidence: 'high',
      type: 'trend',
    });
  }

  // Insight 3: Opportunity signal
  if (topOpp) {
    insightTemplates.push({
      id: 'insight-3',
      title: `Highest-ROI Opportunity: "${topOpp.label}"`,
      body: `Among all validated signals, "${topOpp.label}" presents the strongest product opportunity. ` +
        `With ${topOpp.volume} vocal users expressing this pain and ${topOpp.opportunities.length} identified product gaps, ` +
        `a targeted feature investment here could convert frustrated users into product advocates. ` +
        `Recommended next step: conduct 5 customer discovery interviews focused specifically on this theme.`,
      relatedSignals: [topOpp.id],
      confidence: 'medium',
      type: 'opportunity',
    });
  }

  const topRisk = critical[0] ?? high[0] ?? signals[0];
  const headline = topSignal
    ? `${config.companyName || 'Your Market'}: ${critical.length} critical signals detected across ${signals.length} validated topics`
    : 'Analysis complete — insufficient data for strong signals';

  return {
    headline,
    topOpportunity: topOpp?.opportunities[0] ?? 'Invest in user onboarding experience based on friction signals',
    topRisk: topRisk?.risks[0] ?? 'Monitor growing complaint velocity before it impacts retention',
    insights: insightTemplates,
    generatedAt: Date.now(),
    isAiGenerated: false,
  };
}

// ── LLM-backed insight generator ──────────────────────────────────────────

async function generateLLMInsights(
  signals: Signal[],
  config: WorkspaceConfig,
): Promise<ExecutiveSummary> {
  const top5 = signals.slice(0, 5);
  const signalSummary = top5.map(s =>
    `- Signal "${s.label}" (Score: ${s.score}/100, Severity: ${s.severity}, Volume: ${s.volume} posts, Negativity: ${s.negativity}%, Growth: ${s.growthRate}%)\n  Risks: ${s.risks.slice(0, 2).join('; ')}\n  Opportunities: ${s.opportunities.slice(0, 2).join('; ')}`
  ).join('\n');

  const prompt = `You are an expert R&D intelligence analyst. Analyze the following market signals for a ${config.industry} company named ${config.companyName} and generate a concise executive intelligence brief.

TOP SIGNALS:
${signalSummary}

Generate a JSON response with this exact structure:
{
  "headline": "One compelling sentence summarizing the overall intelligence picture",
  "topOpportunity": "The single highest-ROI product opportunity",
  "topRisk": "The single most critical risk to address",
  "insights": [
    {
      "id": "insight-1",
      "title": "Insight title",
      "body": "2-3 sentence strategic analysis with causal reasoning",
      "relatedSignals": ["signal id"],
      "confidence": "high|medium|low",
      "type": "risk|opportunity|trend"
    }
  ]
}
Generate exactly 3 insights. Be specific, actionable, and connect signals causally.`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.llmApiKey}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  const parsed = JSON.parse(raw) as Partial<ExecutiveSummary>;
  return {
    headline: parsed.headline ?? '',
    topOpportunity: parsed.topOpportunity ?? '',
    topRisk: parsed.topRisk ?? '',
    insights: (parsed.insights ?? []).map((ins, i) => ({
      id: `insight-${i}`,
      title: (ins as StrategicInsight).title ?? '',
      body: (ins as StrategicInsight).body ?? '',
      relatedSignals: (ins as StrategicInsight).relatedSignals ?? [],
      confidence: (ins as StrategicInsight).confidence ?? 'medium',
      type: (ins as StrategicInsight).type ?? 'trend',
    })),
    generatedAt: Date.now(),
    isAiGenerated: true,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function runInsightAgent(
  signals: Signal[],
  config: WorkspaceConfig,
  onProgress: (msg: string) => void,
): Promise<ExecutiveSummary> {
  onProgress('Insight Agent: Connecting signals and generating strategic intelligence...');
  await new Promise(r => setTimeout(r, 300));

  if (config.llmApiKey) {
    try {
      onProgress('Insight Agent: Calling LLM for strategic analysis...');
      const summary = await generateLLMInsights(signals, config);
      onProgress('Insight Agent: AI executive summary generated ✓');
      return summary;
    } catch (err) {
      console.warn('[InsightAgent] LLM failed, falling back to rule-based:', err);
      onProgress('Insight Agent: LLM failed — using rule-based fallback...');
    }
  }

  const summary = buildRuleBasedInsights(signals, config);
  onProgress('Insight Agent: Strategic insights generated ✓');
  return summary;
}
