"""
Sentiment Agent
Hybrid approach: VADER lexicon + rule-based amplification.
Outputs: positive / neutral / negative label + normalized score (-1.0 to +1.0)
Production extension: swap VADER for trained TF-IDF+SVC model.
"""
import time
import re
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from memory import SharedMemory, ProcessedPost, AgentLog

_analyzer = SentimentIntensityAnalyzer()

# Amplification terms: product-specific negative signals
STRONG_NEGATIVE = {
    "fraud", "scam", "broken", "crash", "fails", "failed", "failure",
    "worst", "terrible", "horrible", "useless", "refund", "cancel",
    "stolen", "missing", "lost", "damaged", "delay", "delayed", "late",
    "wrong", "incorrect", "never", "never received", "pathetic", "garbage",
    "rip off", "ripoff", "cheated", "cheating", "lies", "lying", "blocked",
    "unacceptable", "disappointed", "disgrace", "waste", "awful"
}

STRONG_POSITIVE = {
    "excellent", "amazing", "fantastic", "best", "love", "great",
    "superb", "perfect", "wonderful", "recommend", "impressed", "reliable",
    "fast", "smooth", "easy", "convenient", "helpful", "awesome"
}


def _clean_text(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[^\w\s.,!?'-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:1500]


def _score(title: str, body: str) -> tuple[str, float, float]:
    combined = f"{title}. {body}".lower().strip()
    clean = _clean_text(combined)

    # VADER base score
    scores = _analyzer.polarity_scores(clean)
    compound = scores["compound"]  # -1.0 to +1.0

    # Amplify with domain-specific terms
    words = set(clean.split())
    neg_hits = len(words & STRONG_NEGATIVE)
    pos_hits = len(words & STRONG_POSITIVE)

    compound -= neg_hits * 0.07
    compound += pos_hits * 0.05
    compound = max(-1.0, min(1.0, compound))

    # Label with stricter threshold for complaints (domain-tuned)
    if compound <= -0.05:
        label = "negative"
    elif compound >= 0.20:
        label = "positive"
    else:
        label = "neutral"

    confidence = min(0.99, abs(compound) * 1.3 + 0.3)
    return label, compound, confidence


def run_sentiment(memory: SharedMemory) -> None:
    start = time.time()
    memory.agent_logs.append(AgentLog("Sentiment Agent", "running", f"Scoring {len(memory.raw_posts)} posts...", time.time()))

    results = []
    for post in memory.raw_posts:
        label, score, confidence = _score(post.title, post.body)
        clean = _clean_text(f"{post.title}. {post.body}")
        results.append(ProcessedPost(
            id=post.id,
            title=post.title,
            body=post.body,
            clean_text=clean,
            score=post.score,
            num_comments=post.num_comments,
            subreddit=post.subreddit,
            author=post.author,
            created_utc=post.created_utc,
            url=post.url,
            source=post.source,
            sentiment_label=label,
            sentiment_score=score,
            sentiment_confidence=confidence,
            location=post.location,
        ))

    memory.processed_posts = results
    neg = sum(1 for p in results if p.sentiment_label == "negative")
    pos = sum(1 for p in results if p.sentiment_label == "positive")
    duration = int((time.time() - start) * 1000)
    memory.agent_logs.append(AgentLog(
        "Sentiment Agent", "done",
        f"Scored {len(results)} posts — {neg} negative, {pos} positive, {len(results)-neg-pos} neutral",
        time.time(), duration
    ))
