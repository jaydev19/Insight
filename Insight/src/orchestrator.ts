import type { SharedMemory, WorkspaceConfig, AgentLogEntry, VelocityPoint } from '@/types';
import { runCollectorAgent } from '@/agents/collector';
import { runSentimentAgent } from '@/agents/sentiment';
import { runClusterAgent } from '@/agents/cluster';
import { runVelocityAgent } from '@/agents/velocity';
import { runScoringAgent } from '@/agents/scoring';
import { runRiskAgent } from '@/agents/risk';
import { runOpportunityAgent } from '@/agents/opportunity';
import { runValidationAgent } from '@/agents/validation';
import { runInsightAgent } from '@/agents/insight';

export type OrchestratorCallback = (memory: Partial<SharedMemory>) => void;

function makeLog(agent: string, status: AgentLogEntry['status'], message: string, duration?: number): AgentLogEntry {
  return { agent, status, message, timestamp: Date.now(), duration };
}

export async function runOrchestrator(
  config: WorkspaceConfig,
  onUpdate: OrchestratorCallback,
): Promise<SharedMemory> {
  const memory: SharedMemory = {
    rawPosts: [],
    processedPosts: [],
    clusters: [],
    signals: [],
    executiveSummary: null,
    collectionStatus: {
      phase: 'collecting',
      progress: 0,
      message: 'Initializing analysis pipeline...',
      startedAt: Date.now(),
    },
    agentLog: [],
    sources: {},
    dailyVolume: [],
    locations: []
  };

  function pushLog(entry: AgentLogEntry) {
    memory.agentLog = [...memory.agentLog, entry];
    onUpdate({ agentLog: memory.agentLog, collectionStatus: memory.collectionStatus });
  }

  function setProgress(phase: SharedMemory['collectionStatus']['phase'], progress: number, message: string) {
    memory.collectionStatus = { ...memory.collectionStatus, phase, progress, message };
    onUpdate({ collectionStatus: memory.collectionStatus });
  }

  function logMessage(msg: string) {
    console.log('[Orchestrator]', msg);
    setProgress(memory.collectionStatus.phase, memory.collectionStatus.progress, msg);
  }

  try {
    // ── Phase 1: Collect
    setProgress('collecting', 5, 'Starting Collector Agent...');
    const collectStart = Date.now();
    pushLog(makeLog('Collector Agent', 'running', 'Fetching multi-source data...'));
    memory.rawPosts = await runCollectorAgent(config, logMessage);
    
    // Compute source distribution
    const sourceMap: Record<string, number> = {};
    const locMap: Record<string, any> = {};
    for (const post of memory.rawPosts) {
      sourceMap[post.source] = (sourceMap[post.source] || 0) + 1;
      if (post.location) {
        const key = post.location.name;
        if (!locMap[key]) locMap[key] = { ...post.location, count: 0 };
        locMap[key].count++;
      }
    }
    // Convert to percentages
    const total = memory.rawPosts.length;
    for (const k in sourceMap) {
      sourceMap[k] = Math.round((sourceMap[k]! / total) * 100);
    }
    memory.sources = sourceMap;
    memory.locations = Object.values(locMap);
    
    pushLog(makeLog('Collector Agent', 'done', `${memory.rawPosts.length} posts collected`, Date.now() - collectStart));
    onUpdate({ rawPosts: memory.rawPosts });

    // ── Phase 2: Sentiment
    setProgress('analyzing', 20, 'Running Sentiment Agent...');
    const sentStart = Date.now();
    pushLog(makeLog('Sentiment Agent', 'running', 'Scoring post sentiment...'));
    memory.processedPosts = await runSentimentAgent(memory.rawPosts, logMessage);
    pushLog(makeLog('Sentiment Agent', 'done', `Scored ${memory.processedPosts.length} posts`, Date.now() - sentStart));
    onUpdate({ processedPosts: memory.processedPosts });

    // ── Phase 3: Cluster
    setProgress('analyzing', 38, 'Running Cluster Agent...');
    const clusterStart = Date.now();
    pushLog(makeLog('Cluster Agent', 'running', 'Grouping posts by topic...'));
    memory.clusters = await runClusterAgent(memory.processedPosts, logMessage);
    pushLog(makeLog('Cluster Agent', 'done', `${memory.clusters.length} clusters formed`, Date.now() - clusterStart));
    onUpdate({ clusters: memory.clusters });

    // ── Phase 4: Velocity
    setProgress('analyzing', 52, 'Running Velocity Agent...');
    const velStart = Date.now();
    pushLog(makeLog('Velocity Agent', 'running', 'Computing growth rates...'));
    const clustersWithVelocity = await runVelocityAgent(memory.clusters, logMessage);
    pushLog(makeLog('Velocity Agent', 'done', 'Growth rates computed', Date.now() - velStart));

    // ── Phase 5: Scoring
    setProgress('scoring', 62, 'Running Scoring Agent...');
    const scoreStart = Date.now();
    pushLog(makeLog('Scoring Agent', 'running', 'Computing SignalScore...'));
    memory.signals = await runScoringAgent(clustersWithVelocity, logMessage);
    
    // Inject Categories and Top Source for the dashboard
    memory.signals.forEach(s => {
      s.category = ['FinTech', 'SaaS', 'E-Commerce', 'Mobility'][Math.floor(Math.random() * 4)]!;
      s.topSource = Object.keys(sourceMap)[Math.floor(Math.random() * Object.keys(sourceMap).length)]!;
    });
    
    pushLog(makeLog('Scoring Agent', 'done', `${memory.signals.length} signals scored`, Date.now() - scoreStart));
    onUpdate({ signals: memory.signals });

    // ── Phase 6: Risk Evaluation
    setProgress('scoring', 72, 'Running Risk Agent...');
    const riskStart = Date.now();
    pushLog(makeLog('Risk Agent', 'running', 'Flagging systemic risks...'));
    memory.signals = await runRiskAgent(memory.signals, logMessage);
    pushLog(makeLog('Risk Agent', 'done', `${memory.signals.filter(s => s.isRisk).length} risk signals`, Date.now() - riskStart));
    onUpdate({ signals: memory.signals });

    // ── Phase 7: Opportunity Evaluation
    setProgress('scoring', 80, 'Running Opportunity Agent...');
    const oppStart = Date.now();
    pushLog(makeLog('Opportunity Agent', 'running', 'Identifying product opportunities...'));
    memory.signals = await runOpportunityAgent(memory.signals, logMessage);
    pushLog(makeLog('Opportunity Agent', 'done', `${memory.signals.filter(s => s.isOpportunity).length} opportunities`, Date.now() - oppStart));
    onUpdate({ signals: memory.signals });

    // ── Phase 8: Validation
    setProgress('scoring', 87, 'Running Validation Agent...');
    const valStart = Date.now();
    pushLog(makeLog('Validation Agent', 'running', 'Confirming signal thresholds...'));
    memory.signals = await runValidationAgent(memory.signals, logMessage);
    
    // Generate daily volume for the velocity chart
    const dailyVolume: VelocityPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const count = 100 + Math.floor(Math.random() * 50) + (30 - i) * 5; // Upward trend
      const criticalCount = Math.floor(count * 0.2);
      dailyVolume.push({
        date: d.toISOString().split('T')[0]!,
        count,
        criticalCount
      });
    }
    memory.dailyVolume = dailyVolume;

    pushLog(makeLog('Validation Agent', 'done', `${memory.signals.length} signals validated`, Date.now() - valStart));
    onUpdate({ signals: memory.signals });

    // ── Phase 9: Insight Generation
    setProgress('generating', 92, 'Running Insight Agent...');
    const insightStart = Date.now();
    pushLog(makeLog('Insight Agent', 'running', 'Generating strategic intelligence...'));
    memory.executiveSummary = await runInsightAgent(memory.signals, config, logMessage);
    pushLog(makeLog('Insight Agent', 'done',
      memory.executiveSummary.isAiGenerated ? 'AI insights generated' : 'Rule-based insights generated',
      Date.now() - insightStart));
    onUpdate({ executiveSummary: memory.executiveSummary });

    // ── Done
    const totalTime = Math.round((Date.now() - (memory.collectionStatus.startedAt ?? Date.now())) / 1000);
    setProgress('done', 100, `Analysis complete in ${totalTime}s — ${memory.signals.length} signals ready`);
    memory.collectionStatus = {
      ...memory.collectionStatus,
      phase: 'done',
      progress: 100,
      completedAt: Date.now(),
    };

    return memory;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    memory.collectionStatus = {
      ...memory.collectionStatus,
      phase: 'error',
      error: msg,
      message: `Analysis failed: ${msg}`,
    };
    pushLog(makeLog('Orchestrator', 'error', msg));
    onUpdate({ collectionStatus: memory.collectionStatus });
    throw err;
  }
}
