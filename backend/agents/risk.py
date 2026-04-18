"""
Risk Agent
Computes severity score using weighted formula:
  score = 0.35 * norm_volume + 0.40 * negativity + 0.25 * norm_growth

Maps score -> Critical / High / Medium / Low
Pattern-matches cluster labels to known risk categories.
"""
import time
import re
from memory import SharedMemory, Signal, Cluster, Severity, AgentLog

VOLUME_W = 0.35
SENTIMENT_W = 0.40
VELOCITY_W = 0.25

RISK_PATTERNS = [
    (r"refund|return|money back|cashback", "Refund/return friction is a top churn driver in consumer fintech"),
    (r"crash|error|bug|fail|broken|down|outage", "Product reliability failures erode trust and trigger negative word-of-mouth"),
    (r"support|response|help|ticket|chat|agent", "Support unresponsiveness converts problems into public complaints"),
    (r"payment|transaction|transfer|upi|bank", "Payment failures have zero tolerance in commerce — direct revenue loss"),
    (r"delivery|late|delay|slow|tracking", "Delivery experience defines brand perception in quick commerce"),
    (r"price|pricing|cost|expensive|hidden fee|charge", "Pricing opacity destroys trust and fuels competitor switching"),
    (r"account|login|otp|blocked|suspend|verify", "Account friction blocks users from completing transactions"),
    (r"data|privacy|information|leak|hacked", "Data security incidents trigger regulatory risk and mass churn"),
]


def _normalize(val: float, lo: float, hi: float) -> float:
    if hi == lo:
        return 0.0
    return max(0.0, min(1.0, (val - lo) / (hi - lo)))


def _detect_risks(label: str, keywords: list, posts: list) -> list[str]:
    text = f"{label} {' '.join(keywords[:10])} {' '.join(p.title for p in posts[:5])}".lower()
    risks = []
    for pattern, risk in RISK_PATTERNS:
        if re.search(pattern, text):
            risks.append(risk)
    return list(dict.fromkeys(risks))  # deduplicate while preserving order


def run_risk(memory: SharedMemory, cluster_velocities: dict) -> None:
    start = time.time()
    memory.agent_logs.append(AgentLog("Risk Agent", "running", f"Scoring {len(memory.clusters)} clusters...", time.time()))

    if not memory.clusters:
        memory.agent_logs.append(AgentLog("Risk Agent", "done", "No clusters to score", time.time()))
        return

    volumes = [c.volume for c in memory.clusters]
    growth_rates = [cluster_velocities.get(c.id, {}).get("growth_rate", 0.0) for c in memory.clusters]

    min_vol, max_vol = min(volumes), max(volumes)
    max_growth = max(max(growth_rates), 1.0)

    signals = []
    for i, cluster in enumerate(memory.clusters):
        vel_data = cluster_velocities.get(cluster.id, {})
        growth_rate = vel_data.get("growth_rate", 0.0)
        velocity = vel_data.get("velocity", [])

        norm_vol = _normalize(cluster.volume, min_vol, max_vol)
        norm_growth = _normalize(max(0.0, growth_rate), 0, max_growth)
        raw_score = (VOLUME_W * norm_vol + SENTIMENT_W * cluster.negativity + VELOCITY_W * norm_growth) * 100

        score = round(min(100.0, raw_score), 1)

        if score >= 72:
            severity = Severity.CRITICAL
        elif score >= 52:
            severity = Severity.HIGH
        elif score >= 32:
            severity = Severity.MEDIUM
        else:
            severity = Severity.LOW

        risks = _detect_risks(cluster.label, cluster.keywords, cluster.posts)
        is_risk = bool(risks) or severity in (Severity.CRITICAL, Severity.HIGH)
        top_source = cluster.sources[0] if cluster.sources else "Reddit"

        signals.append(Signal(
            id=f"signal-{i}",
            cluster_id=cluster.id,
            label=cluster.label,
            description=cluster.posts[0].title if cluster.posts else cluster.label,
            score=score,
            severity=severity,
            volume=cluster.volume,
            negativity=round(cluster.negativity * 100),
            growth_rate=growth_rate,
            velocity=velocity,
            risks=risks,
            opportunities=[],
            is_risk=is_risk,
            is_opportunity=False,
            validated=False,
            posts=cluster.posts,
            category="Product",
            top_source=top_source,
        ))

    signals.sort(key=lambda s: s.score, reverse=True)
    memory.signals = signals

    critical = sum(1 for s in signals if s.severity == Severity.CRITICAL)
    duration = int((time.time() - start) * 1000)
    memory.agent_logs.append(AgentLog(
        "Risk Agent", "done",
        f"{len(signals)} signals scored — {critical} critical",
        time.time(), duration
    ))
