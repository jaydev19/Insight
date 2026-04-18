"""
Opportunity Agent
Converts high-frequency complaints into actionable product opportunities.
Each pattern maps a pain signal to a specific product feature recommendation.
"""
import time
import re
from memory import SharedMemory, AgentLog

OPP_PATTERNS = [
    (r"refund|return|money back", "Build real-time refund status tracker with automated SLA notifications"),
    (r"crash|bug|error|fail|broken", "Implement crash analytics and proactive user error recovery flows"),
    (r"support|response|help|chat|agent", "Deploy AI-powered instant support with < 30s first response guarantee"),
    (r"payment|transaction|fail|upi", "Build payment retry intelligence with smart gateway fallback routing"),
    (r"delivery|late|track|status", "Create live delivery tracking with proactive delay alerts and compensation"),
    (r"price|discount|expensive|cheaper|cost", "Introduce transparent pricing dashboard with loyalty reward visibility"),
    (r"account|login|otp|blocked", "Implement frictionless re-authentication with biometric fallback options"),
    (r"slow|performance|loading|fast", "Invest in performance optimization targeting < 2s load time globally"),
    (r"onboard|setup|confus|difficult|first", "Build contextual onboarding wizard with role-based personalization"),
    (r"data|export|download|report", "Add self-serve analytics dashboard with one-click data export (CSV/JSON)"),
]


def run_opportunity(memory: SharedMemory) -> None:
    start = time.time()
    memory.agent_logs.append(AgentLog("Opportunity Agent", "running", "Mapping pain signals to product opportunities...", time.time()))

    opp_count = 0
    for signal in memory.signals:
        opportunities = []
        search_text = f"{signal.label} {' '.join(signal.risks)} {signal.description}".lower()

        for pattern, opp in OPP_PATTERNS:
            if re.search(pattern, search_text):
                opportunities.append(opp)

        # High volume + high negativity = validated unmet need
        if signal.negativity >= 60 and signal.volume >= 3:
            opportunities.append(
                f"High complaint frequency ({signal.volume} mentions, {signal.negativity}% negativity) "
                "validates a clear market gap — prioritize for roadmap Q1"
            )

        signal.opportunities = list(dict.fromkeys(opportunities))
        if signal.opportunities:
            signal.is_opportunity = True
            opp_count += 1

    duration = int((time.time() - start) * 1000)
    memory.agent_logs.append(AgentLog(
        "Opportunity Agent", "done",
        f"Found {opp_count} opportunity signals from {len(memory.signals)} clusters",
        time.time(), duration
    ))
