"""
Insight Agent (Hybrid)
Reads validated structured signals, connects them causally,
and generates an executive intelligence brief.

Uses Gemini API if key provided; falls back to deterministic rule-based engine.
LLM only reasons on VALIDATED signals — never generates raw fake data.
"""
import time
import json
import re
from memory import SharedMemory, ExecutiveSummary, StrategicInsight, Severity, AgentLog

# ── Rule-based fallback ────────────────────────────────────────────────────

def _rule_based(memory: SharedMemory, company: str, industry: str) -> ExecutiveSummary:
    signals = memory.signals
    critical = [s for s in signals if s.severity == Severity.CRITICAL]
    high = [s for s in signals if s.severity == Severity.HIGH]
    opp_signals = [s for s in signals if s.is_opportunity]
    top = signals[0] if signals else None
    top_opp = sorted(opp_signals, key=lambda s: s.score, reverse=True)[0] if opp_signals else None

    insights = []

    if top:
        insights.append(StrategicInsight(
            id="i-1",
            title=f'Critical Signal: "{top.label}"',
            body=(
                f'The "{top.label}" cluster scores {top.score}/100 with {top.volume} posts '
                f'and {top.negativity}% negativity. '
                + (f'Growing at {top.growth_rate}% WoW — actively worsening. '
                   if top.growth_rate > 10 else 'Volume is stable but persistently high. ')
                + (f'Top risk: {top.risks[0]}' if top.risks else '')
            ),
            related_signals=[top.id],
            confidence="high",
            insight_type="risk",
        ))

    if len(critical) + len(high) >= 2:
        cross = (critical + high)[:3]
        insights.append(StrategicInsight(
            id="i-2",
            title="Converging Signals — Systemic Product-Market Gap",
            body=(
                f'{len(cross)} high-severity clusters converging simultaneously: '
                + ", ".join(f'"{s.label}"' for s in cross)
                + f'. Covering {sum(s.volume for s in cross)} mentions, this pattern indicates '
                  'a fundamental gap between product promises and delivered experience.'
            ),
            related_signals=[s.id for s in cross],
            confidence="high",
            insight_type="trend",
        ))

    if top_opp:
        insights.append(StrategicInsight(
            id="i-3",
            title=f'Highest-ROI Opportunity: "{top_opp.label}"',
            body=(
                f'{top_opp.volume} users are actively expressing pain around "{top_opp.label}". '
                + (f'Recommended action: {top_opp.opportunities[0]}' if top_opp.opportunities else '')
                + ' This is a validated market gap with measurable user demand.'
            ),
            related_signals=[top_opp.id],
            confidence="medium",
            insight_type="opportunity",
        ))

    top_risk_signal = critical[0] if critical else (high[0] if high else top)
    return ExecutiveSummary(
        headline=(
            f'{company}: {len(critical)} critical + {len(high)} high-severity signals '
            f'across {len(signals)} validated topics in {industry}'
        ) if signals else f'{company}: Insufficient signal data for analysis',
        top_opportunity=top_opp.opportunities[0] if (top_opp and top_opp.opportunities) else "Monitor community sentiment for emerging product gaps",
        top_risk=top_risk_signal.risks[0] if (top_risk_signal and top_risk_signal.risks) else "No critical risks detected",
        insights=insights,
        generated_at=time.time(),
        is_ai_generated=False,
    )


# ── Gemini-backed generation ───────────────────────────────────────────────

def _gemini(memory: SharedMemory, company: str, industry: str, api_key: str) -> ExecutiveSummary:
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    top5 = memory.signals[:5]
    signal_summary = "\n".join(
        f'- "{s.label}" | Score: {s.score}/100 | {s.severity.value.upper()} | '
        f'Vol: {s.volume} | Neg: {s.negativity}% | Growth: {s.growth_rate}%\n'
        f'  Risks: {"; ".join(s.risks[:2])}\n'
        f'  Opportunities: {"; ".join(s.opportunities[:2])}'
        for s in top5
    )

    prompt = f"""You are a senior R&D intelligence analyst. Analyze these validated market signals for {company} ({industry}) and generate a JSON executive brief.

VALIDATED SIGNALS (from real Reddit/NewsAPI data, TF-IDF clustered, sentiment-scored):
{signal_summary}

Return ONLY valid JSON in this exact structure:
{{
  "headline": "One specific, compelling sentence about {company}'s intelligence picture",
  "top_risk": "The single most urgent risk with specific action",
  "top_opportunity": "The single highest-ROI product opportunity",
  "insights": [
    {{
      "id": "i-1",
      "title": "Specific title",
      "body": "2-3 sentences with causal reasoning based only on the data above",
      "related_signals": ["signal-0"],
      "confidence": "high",
      "type": "risk"
    }},
    {{...}},
    {{...}}
  ]
}}

Generate exactly 3 insights. Base everything ONLY on the validated signals above. No hallucination."""

    response = model.generate_content(prompt)
    raw = response.text.strip()

    # Extract JSON block
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError("Gemini returned no valid JSON")

    parsed = json.loads(match.group())

    insights = [
        StrategicInsight(
            id=ins.get("id", f"i-{i}"),
            title=ins.get("title", ""),
            body=ins.get("body", ""),
            related_signals=ins.get("related_signals", []),
            confidence=ins.get("confidence", "medium"),
            insight_type=ins.get("type", "trend"),
        )
        for i, ins in enumerate(parsed.get("insights", []))
    ]

    return ExecutiveSummary(
        headline=parsed.get("headline", ""),
        top_opportunity=parsed.get("top_opportunity", ""),
        top_risk=parsed.get("top_risk", ""),
        insights=insights,
        generated_at=time.time(),
        is_ai_generated=True,
    )


# ── Public interface ───────────────────────────────────────────────────────

def run_insight(memory: SharedMemory, company: str, industry: str, gemini_key: str = "") -> None:
    start = time.time()
    memory.agent_logs.append(AgentLog("Insight Agent", "running", "Synthesizing signals into executive intelligence...", time.time()))

    if gemini_key and memory.signals:
        try:
            memory.agent_logs.append(AgentLog("Insight Agent", "running", "Calling Gemini 1.5 Flash for strategic analysis...", time.time()))
            memory.executive_summary = _gemini(memory, company, industry, gemini_key)
            duration = int((time.time() - start) * 1000)
            memory.agent_logs.append(AgentLog("Insight Agent", "done", "AI executive summary generated ✓", time.time(), duration))
            return
        except Exception as e:
            print(f"[InsightAgent] Gemini failed: {e}, using rule-based fallback")
            memory.agent_logs.append(AgentLog("Insight Agent", "running", f"Gemini failed ({e}), using deterministic fallback...", time.time()))

    memory.executive_summary = _rule_based(memory, company, industry)
    duration = int((time.time() - start) * 1000)
    mode = "AI" if (memory.executive_summary.is_ai_generated) else "rule-based"
    memory.agent_logs.append(AgentLog("Insight Agent", "done", f"Executive summary generated ({mode}) ✓", time.time(), duration))
