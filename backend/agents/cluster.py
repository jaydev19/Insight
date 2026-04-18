"""
Cluster Agent
Groups posts into topic clusters using TF-IDF + KMeans.
Auto-detects optimal K using silhouette score.
Extracts cluster labels from top TF-IDF terms.
"""
import time
import re
from collections import Counter
from typing import List
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans, MiniBatchKMeans
from sklearn.preprocessing import normalize
from memory import SharedMemory, Cluster, ProcessedPost, AgentLog

STOPWORDS = {
    "the","a","an","and","or","but","in","on","at","to","for","of","with",
    "is","are","was","were","be","been","have","has","had","do","does","did",
    "will","would","could","should","this","that","these","those","i","we",
    "you","he","she","it","they","my","our","your","his","her","its","their",
    "get","got","just","like","really","very","also","even","still","back",
    "use","using","used","make","made","go","going","good","bad","new",
    "one","two","time","day","week","month","year","company","product",
    "people","way","know","want","need","can","said","dont","doesnt",
    "https","http","www","com","just","im","its"
}


def _clean(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text.lower())
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    tokens = [t for t in text.split() if len(t) > 2 and t not in STOPWORDS]
    return " ".join(tokens)


def _pick_k(X, min_k: int = 3, max_k: int = 12) -> int:
    """Choose optimal K using inertia elbow heuristic (fast, no silhouette cost)."""
    n = X.shape[0]
    max_k = min(max_k, n - 1)
    min_k = min(min_k, max_k)
    if min_k >= max_k:
        return min_k

    inertias = []
    ks = list(range(min_k, max_k + 1))
    for k in ks:
        km = MiniBatchKMeans(n_clusters=k, random_state=42, n_init=3)
        km.fit(X)
        inertias.append(km.inertia_)

    # Elbow: find biggest drop in inertia gradient
    if len(inertias) < 3:
        return min_k
    diffs = [inertias[i] - inertias[i + 1] for i in range(len(inertias) - 1)]
    best_idx = int(np.argmax(diffs))
    return ks[best_idx]


def _top_terms(posts: List[ProcessedPost], n: int = 5) -> List[str]:
    words = []
    for p in posts:
        words.extend(_clean(f"{p.title} {p.body}").split())
    freq = Counter(words)
    return [w for w, _ in freq.most_common(n)]


def run_cluster(memory: SharedMemory) -> None:
    start = time.time()
    posts = memory.processed_posts

    if not posts:
        memory.agent_logs.append(AgentLog("Cluster Agent", "error", "No posts to cluster", time.time()))
        return

    memory.agent_logs.append(AgentLog("Cluster Agent", "running", f"Vectorizing {len(posts)} posts with TF-IDF...", time.time()))

    texts = [_clean(f"{p.title} {p.body}") for p in posts]

    # TF-IDF vectorization
    vec = TfidfVectorizer(
        max_features=3000,
        ngram_range=(1, 2),
        min_df=2,
        sublinear_tf=True,
    )
    try:
        X = vec.fit_transform(texts)
    except ValueError:
        # If min_df=2 causes issues with small datasets
        vec = TfidfVectorizer(max_features=1000, ngram_range=(1, 2))
        X = vec.fit_transform(texts)

    X_norm = normalize(X)

    # Choose K
    n_docs = X_norm.shape[0]
    k = _pick_k(X_norm.toarray() if hasattr(X_norm, 'toarray') else X_norm, min_k=3, max_k=min(12, n_docs - 1))

    memory.agent_logs.append(AgentLog("Cluster Agent", "running", f"Running KMeans with K={k}...", time.time()))

    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(X_norm)

    # Get top terms per cluster from TF-IDF vocabulary
    feature_names = vec.get_feature_names_out()
    order_centroids = km.cluster_centers_.argsort()[:, ::-1]

    clusters = []
    for cluster_idx in range(k):
        # Posts in this cluster
        cluster_posts = [posts[i] for i, l in enumerate(labels) if l == cluster_idx]
        if not cluster_posts:
            continue

        # Top TF-IDF terms as cluster label
        top_terms = [feature_names[j] for j in order_centroids[cluster_idx][:6]]
        top_terms = [t for t in top_terms if t not in STOPWORDS][:5]
        label = " / ".join(top_terms[:3]) if top_terms else f"Topic {cluster_idx+1}"

        sentiments = [p.sentiment_score for p in cluster_posts]
        avg_sent = float(np.mean(sentiments))
        neg_count = sum(1 for p in cluster_posts if p.sentiment_label == "negative")
        negativity = neg_count / len(cluster_posts)

        subreddits = list({p.subreddit for p in cluster_posts if p.subreddit})
        sources = list({p.source for p in cluster_posts})
        times = [p.created_utc for p in cluster_posts]

        clusters.append(Cluster(
            id=f"cluster-{cluster_idx}",
            label=label,
            keywords=top_terms,
            posts=cluster_posts,
            volume=len(cluster_posts),
            avg_sentiment=round(avg_sent, 3),
            negativity=round(negativity, 3),
            subreddits=subreddits,
            sources=sources,
            first_seen=min(times),
            last_seen=max(times),
        ))

    # Sort by volume descending
    clusters.sort(key=lambda c: c.volume, reverse=True)
    memory.clusters = clusters

    duration = int((time.time() - start) * 1000)
    memory.agent_logs.append(AgentLog(
        "Cluster Agent", "done",
        f"Formed {len(clusters)} topic clusters (K={k}, TF-IDF vocab={X.shape[1]})",
        time.time(), duration
    ))
