"""
Shared Memory Model — Agent Communication Bus
Each agent reads from and writes to this structure.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class RawPost:
    id: str
    title: str
    body: str
    score: int
    num_comments: int
    subreddit: str
    author: str
    created_utc: float
    url: str
    source: str  # Reddit | NewsAPI | Forums
    location: Optional[Dict] = None


@dataclass
class ProcessedPost:
    id: str
    title: str
    body: str
    clean_text: str
    score: int
    num_comments: int
    subreddit: str
    author: str
    created_utc: float
    url: str
    source: str
    sentiment_label: str      # positive | neutral | negative
    sentiment_score: float    # -1.0 to +1.0
    sentiment_confidence: float
    location: Optional[Dict] = None


@dataclass
class VelocityPoint:
    date: str         # YYYY-MM-DD
    count: int
    critical_count: int = 0


@dataclass
class Cluster:
    id: str
    label: str
    keywords: List[str]
    posts: List[ProcessedPost]
    volume: int
    avg_sentiment: float
    negativity: float   # 0.0–1.0
    subreddits: List[str]
    sources: List[str]
    first_seen: float
    last_seen: float


@dataclass
class Signal:
    id: str
    cluster_id: str
    label: str
    description: str
    score: float           # 0–100
    severity: Severity
    volume: int
    negativity: float
    growth_rate: float
    velocity: List[VelocityPoint]
    risks: List[str]
    opportunities: List[str]
    is_risk: bool
    is_opportunity: bool
    validated: bool
    posts: List[ProcessedPost]
    category: str
    top_source: str


@dataclass
class StrategicInsight:
    id: str
    title: str
    body: str
    related_signals: List[str]
    confidence: str   # high | medium | low
    insight_type: str  # risk | opportunity | trend


@dataclass
class ExecutiveSummary:
    headline: str
    top_opportunity: str
    top_risk: str
    insights: List[StrategicInsight]
    generated_at: float
    is_ai_generated: bool


@dataclass
class AgentLog:
    agent: str
    status: str   # running | done | error
    message: str
    timestamp: float
    duration_ms: Optional[int] = None


@dataclass
class SharedMemory:
    raw_posts: List[RawPost] = field(default_factory=list)
    processed_posts: List[ProcessedPost] = field(default_factory=list)
    clusters: List[Cluster] = field(default_factory=list)
    signals: List[Signal] = field(default_factory=list)
    executive_summary: Optional[ExecutiveSummary] = None
    agent_logs: List[AgentLog] = field(default_factory=list)
    source_distribution: Dict[str, int] = field(default_factory=dict)
    daily_volume: List[VelocityPoint] = field(default_factory=list)
    geo_distribution: List[Dict] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
