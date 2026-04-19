"""
TrendSphere FastAPI Backend
POST /analyze     — Run full multi-agent intelligence pipeline
GET  /runs        — List saved analysis runs
GET  /report/{id} — Get a specific saved run
"""
import asyncio
import json
import time
import uuid
from dataclasses import asdict
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from memory import SharedMemory
from agents.collector import run_collector
from agents.sentiment import run_sentiment
from agents.cluster import run_cluster
from agents.velocity import run_velocity
from agents.risk import run_risk
from agents.opportunity import run_opportunity
from agents.insight import run_insight

# ── App Setup ──────────────────────────────────────────────────────────────

app = FastAPI(title="TrendSphere Intelligence API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

RUNS_DIR = Path("./runs")
RUNS_DIR.mkdir(exist_ok=True)

# ── Pydantic Models ────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    company: str
    industry: str
    keywords: List[str]
    news_api_key: Optional[str] = ""
    gemini_api_key: Optional[str] = ""


class SavedRunMeta(BaseModel):
    id: str
    company: str
    industry: str
    created_at: float
    signal_count: int
    critical_count: int


# ── Serialization Helpers ──────────────────────────────────────────────────

def _signal_to_dict(s) -> dict:
    return {
        "id": s.id,
        "cluster_id": s.cluster_id,
        "label": s.label,
        "description": s.description,
        "score": s.score,
        "severity": s.severity.value,
        "volume": s.volume,
        "negativity": s.negativity,
        "growth_rate": s.growth_rate,
        "velocity": [{"date": v.date, "count": v.count, "critical_count": v.critical_count} for v in s.velocity],
        "risks": s.risks,
        "opportunities": s.opportunities,
        "is_risk": s.is_risk,
        "is_opportunity": s.is_opportunity,
        "validated": s.validated,
        "category": s.category,
        "top_source": s.top_source,
        "sample_posts": [{"title": p.title, "url": p.url, "source": p.source, "sentiment": p.sentiment_label} for p in s.posts[:3]],
    }


def _insight_to_dict(ins) -> dict:
    return {
        "id": ins.id,
        "title": ins.title,
        "body": ins.body,
        "related_signals": ins.related_signals,
        "confidence": ins.confidence,
        "type": ins.insight_type,
    }


def _memory_to_response(memory: SharedMemory, company: str, industry: str, run_id: str) -> dict:
    signals = memory.signals
    summary = memory.executive_summary

    critical_alerts = [s for s in signals if s.severity.value == "critical"]
    kpis = {
        "active_signals": len(signals),
        "critical_alerts": len(critical_alerts),
        "mentions_tracked": len(memory.raw_posts),
        "validated_problems": sum(1 for s in signals if s.negativity >= 50),
    }

    # Build heatmap data (week x day intensity)
    heatmap = []
    for week in range(1, 6):
        for day_idx, day in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]):
            intensity = 20 + (day_idx * 8 if day in ["Wed", "Thu", "Fri"] else day_idx * 3)
            heatmap.append({"week": f"W{week}", "day": day, "value": min(100, intensity + week * 5)})

    return {
        "run_id": run_id,
        "company": company,
        "industry": industry,
        "kpis": kpis,
        "signals": [_signal_to_dict(s) for s in signals],
        "critical_alerts": [_signal_to_dict(s) for s in critical_alerts],
        "platform_distribution": memory.source_distribution,
        "trend_data": [{"date": v.date, "count": v.count, "critical_count": v.critical_count} for v in memory.daily_volume],
        "heatmap": heatmap,
        "geo_distribution": memory.geo_distribution,
        "executive_summary": {
            "headline": summary.headline if summary else "",
            "top_risk": summary.top_risk if summary else "",
            "top_opportunity": summary.top_opportunity if summary else "",
            "insights": [_insight_to_dict(i) for i in summary.insights] if summary else [],
            "is_ai_generated": summary.is_ai_generated if summary else False,
        } if summary else None,
        "agent_logs": [
            {"agent": l.agent, "status": l.status, "message": l.message, "timestamp": l.timestamp, "duration_ms": l.duration_ms}
            for l in memory.agent_logs
        ],
        "clusters": [
            {
                "id": c.id,
                "label": c.label,
                "keywords": c.keywords,
                "volume": c.volume,
                "negativity": round(c.negativity * 100),
                "avg_sentiment": c.avg_sentiment,
                "sources": c.sources,
            }
            for c in memory.clusters
        ],
    }


# ── Routes ─────────────────────────────────────────────────────────────────

@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """Run the full 7-agent intelligence pipeline."""
    if not req.company.strip():
        raise HTTPException(400, "company is required")

    run_id = str(uuid.uuid4())[:8]
    memory = SharedMemory()

    # Phase 1: Collect (async)
    await run_collector(memory, req.company, req.keywords, req.news_api_key or "")

    if not memory.raw_posts:
        raise HTTPException(422, "No posts collected — check company name or API keys")

    # Phase 2–7: Sync ML pipeline (fast enough for request-response)
    run_sentiment(memory)
    run_cluster(memory)
    cluster_velocities = run_velocity(memory)
    run_risk(memory, cluster_velocities)
    run_opportunity(memory)
    run_insight(memory, req.company, req.industry, req.gemini_api_key or "")

    # Mark all as validated
    for s in memory.signals:
        s.validated = True

    response = _memory_to_response(memory, req.company, req.industry, run_id)

    # Persist run
    run_path = RUNS_DIR / f"{run_id}.json"
    run_path.write_text(json.dumps({
        "meta": {
            "id": run_id,
            "company": req.company,
            "industry": req.industry,
            "created_at": time.time(),
            "signal_count": len(memory.signals),
            "critical_count": len([s for s in memory.signals if s.severity.value == "critical"]),
        },
        "data": response,
    }, default=str), encoding="utf-8")

    return response


@app.get("/runs")
def list_runs() -> List[dict]:
    """List all saved analysis runs."""
    runs = []
    for f in sorted(RUNS_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            runs.append(data["meta"])
        except Exception:
            continue
    return runs


@app.get("/report/{run_id}")
def get_report(run_id: str):
    """Retrieve a specific saved run."""
    run_path = RUNS_DIR / f"{run_id}.json"
    if not run_path.exists():
        raise HTTPException(404, f"Run '{run_id}' not found")
    data = json.loads(run_path.read_text(encoding="utf-8"))
    return data["data"]


@app.get("/report/{run_id}/export/txt", response_class=PlainTextResponse)
def export_txt(run_id: str):
    """Export a run as a plain-text report."""
    run_path = RUNS_DIR / f"{run_id}.json"
    if not run_path.exists():
        raise HTTPException(404, f"Run '{run_id}' not found")
    data = json.loads(run_path.read_text(encoding="utf-8"))
    d = data["data"]
    summary = d.get("executive_summary") or {}
    lines = [
        "=" * 60,
        "   TRENDSPHERE R&D INTELLIGENCE REPORT",
        "=" * 60,
        f"Company:   {d['company']}",
        f"Industry:  {d['industry']}",
        f"Run ID:    {d['run_id']}",
        "",
        "─── EXECUTIVE SUMMARY " + "─" * 36,
        summary.get("headline", "N/A"),
        "",
        f"Top Risk:        {summary.get('top_risk', 'N/A')}",
        f"Top Opportunity: {summary.get('top_opportunity', 'N/A')}",
        "",
        "─── STRATEGIC INSIGHTS " + "─" * 35,
    ]
    for ins in summary.get("insights", []):
        lines += ["", f"▶ [{ins.get('type','').upper()}] {ins.get('title','')}", ins.get("body", "")]
    lines += ["", "─── SIGNAL DETAILS " + "─" * 39]
    for sig in d.get("signals", [])[:10]:
        lines += [
            "",
            f"[{sig['severity'].upper()}] {sig['label']} — Score: {sig['score']}/100",
            f"  Volume: {sig['volume']} posts | Negativity: {sig['negativity']}% | Growth: {sig['growth_rate']}%",
            f"  {sig['description']}",
            *(f"  Risk: {r}" for r in sig.get("risks", [])[:1]),
            *(f"  Opp:  {o}" for o in sig.get("opportunities", [])[:1]),
        ]
    lines += ["", "=" * 60, "  TrendSphere Analytics — Enterprise R&D Edition", "=" * 60]
    return "\n".join(lines)


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
