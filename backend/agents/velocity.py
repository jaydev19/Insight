"""
Velocity Agent
Computes week-over-week and day-over-day growth rates per cluster.
Generates daily volume timeseries for the 30-day velocity chart.
"""
import time
from collections import defaultdict
from datetime import datetime, timedelta
from memory import SharedMemory, Cluster, VelocityPoint, AgentLog


def _get_day_key(ts: float) -> str:
    return datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")


def _compute_growth(recent: int, prior: float) -> float:
    if prior == 0:
        return 100.0 if recent > 0 else 0.0
    return round(((recent - prior) / prior) * 100, 1)


def _cluster_velocity(cluster: Cluster) -> tuple[list[VelocityPoint], float]:
    """Compute daily velocity and WoW growth rate for a single cluster."""
    day_counts: dict = defaultdict(int)
    for post in cluster.posts:
        day = _get_day_key(post.created_utc)
        day_counts[day] += 1

    sorted_days = sorted(day_counts.items())

    # Split into two halves: prior vs recent
    half = max(1, len(sorted_days) // 2)
    prior_sum = sum(v for _, v in sorted_days[:half])
    recent_sum = sum(v for _, v in sorted_days[half:])
    prior_avg = prior_sum / half if half > 0 else 0
    growth_rate = _compute_growth(recent_sum, prior_avg)

    velocity = [VelocityPoint(date=d, count=c, critical_count=0) for d, c in sorted_days]
    return velocity, growth_rate


def _build_daily_volume(clusters: list[Cluster]) -> list[VelocityPoint]:
    """Build aggregate daily volume across all clusters for the 30-day chart."""
    today = datetime.utcnow()
    day_counts: dict = defaultdict(lambda: {"count": 0, "critical_count": 0})

    for cluster in clusters:
        is_critical = cluster.negativity > 0.6 and cluster.volume > 3
        for post in cluster.posts:
            day = _get_day_key(post.created_utc)
            day_counts[day]["count"] += 1
            if is_critical:
                day_counts[day]["critical_count"] += 1

    # Fill last 30 days (including empty days)
    result = []
    for i in range(29, -1, -1):
        d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        counts = day_counts.get(d, {"count": 0, "critical_count": 0})
        result.append(VelocityPoint(date=d, count=counts["count"], critical_count=counts["critical_count"]))

    return result


def run_velocity(memory: SharedMemory) -> dict:
    """Returns a dict mapping cluster_id -> (velocity, growth_rate)."""
    start = time.time()
    memory.agent_logs.append(AgentLog("Velocity Agent", "running", "Computing growth rates per cluster...", time.time()))

    cluster_velocities = {}
    for cluster in memory.clusters:
        velocity, growth_rate = _cluster_velocity(cluster)
        cluster_velocities[cluster.id] = {"velocity": velocity, "growth_rate": growth_rate}

    memory.daily_volume = _build_daily_volume(memory.clusters)

    duration = int((time.time() - start) * 1000)
    memory.agent_logs.append(AgentLog(
        "Velocity Agent", "done",
        f"Computed velocity for {len(memory.clusters)} clusters, {len(memory.daily_volume)} daily datapoints",
        time.time(), duration
    ))
    return cluster_velocities
