// ── Core Data Types ────────────────────────────────────────────────────────

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  subreddit: string;
  author: string;
  created_utc: number;
  url: string;
  permalink: string;
  upvote_ratio: number;
  source: 'Reddit' | 'X (Twitter)' | 'YouTube' | 'LinkedIn' | 'Forums';
  location?: { lat: number; lng: number; name: string };
}

export interface ProcessedPost extends RedditPost {
  cleanText: string;
  sentimentScore: number;    // -100 to +100
  sentimentLabel: 'positive' | 'negative' | 'neutral';
  weekKey: string;           // e.g. "2024-W12"
}

// ── Cluster & Signal Types ─────────────────────────────────────────────────

export interface Cluster {
  id: string;
  label: string;
  posts: ProcessedPost[];
  centroidText: string;
  volume: number;
  avgSentiment: number;
  negativity: number;        // 0-100
  subreddits: string[];
  firstSeen: number;
  lastSeen: number;
}

export interface VelocityPoint {
  date: string; // YYYY-MM-DD
  count: number;
  criticalCount: number;
}

export interface Signal {
  id: string;
  clusterId: string;
  label: string;
  description: string;
  score: number;             // computed signal score 0-100
  severity: 'critical' | 'high' | 'medium' | 'low';
  volume: number;
  negativity: number;
  growthRate: number;
  velocity: VelocityPoint[];
  risks: string[];
  opportunities: string[];
  isRisk: boolean;
  isOpportunity: boolean;
  validated: boolean;
  posts: ProcessedPost[];
  category: string;
  topSource: string;
}

// ── Insight & AI Types ─────────────────────────────────────────────────────

export interface StrategicInsight {
  id: string;
  title: string;
  body: string;
  relatedSignals: string[];
  confidence: 'high' | 'medium' | 'low';
  type: 'risk' | 'opportunity' | 'trend';
}

export interface ExecutiveSummary {
  headline: string;
  topOpportunity: string;
  topRisk: string;
  insights: StrategicInsight[];
  generatedAt: number;
  isAiGenerated: boolean;
}

// ── Workspace Config ───────────────────────────────────────────────────────

export type AnalysisDepth = 'quick' | 'standard' | 'deep';

export interface WorkspaceConfig {
  companyName: string;
  industry: string;
  keywords: string[];
  llmApiKey: string; // OpenAI
  newsApiKey: string; // NewsAPI for web/forums
  redditToken?: string;
}

// ── Shared Memory (Agent Bus) ──────────────────────────────────────────────

export interface SharedMemory {
  rawPosts: RedditPost[];
  processedPosts: ProcessedPost[];
  clusters: Cluster[];
  signals: Signal[];
  executiveSummary: ExecutiveSummary | null;
  collectionStatus: CollectionStatus;
  agentLog: AgentLogEntry[];
  sources: Record<string, number>;
  dailyVolume: VelocityPoint[];
  locations: Array<{ name: string; lat: number; lng: number; count: number }>;
}

export interface CollectionStatus {
  phase: 'idle' | 'collecting' | 'analyzing' | 'scoring' | 'generating' | 'done' | 'error';
  progress: number;          // 0-100
  message: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface AgentLogEntry {
  agent: string;
  status: 'running' | 'done' | 'error' | 'skipped';
  message: string;
  timestamp: number;
  duration?: number;
}

// ── History ────────────────────────────────────────────────────────────────

export interface AnalysisRun {
  id: string;
  workspaceConfig: WorkspaceConfig;
  memory: SharedMemory;
  createdAt: number;
  label: string;
}
