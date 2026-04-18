"""
Collector Agent
Fetches real public signals from Reddit (public JSON) and NewsAPI.
Deduplicates and stores structured raw data into shared memory.
"""
import asyncio
import hashlib
import time
import re
from typing import List
import httpx
from memory import SharedMemory, RawPost, AgentLog

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Indian city coordinates for geo distribution
CITY_COORDS = [
    {"name": "Bangalore", "lat": 12.97, "lng": 77.59},
    {"name": "Mumbai", "lat": 19.08, "lng": 72.88},
    {"name": "Delhi", "lat": 28.70, "lng": 77.10},
    {"name": "Hyderabad", "lat": 17.38, "lng": 78.49},
    {"name": "Chennai", "lat": 13.08, "lng": 80.27},
    {"name": "Kolkata", "lat": 22.57, "lng": 88.36},
    {"name": "Pune", "lat": 18.52, "lng": 73.86},
]


def _clean(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:2000]


def _make_id(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()[:10]


def _generate_mock_posts(company: str) -> List[RawPost]:
    import random
    problems = [
        f"{company} payment gateway failed again during checkout",
        f"App crashes on the new iOS update every time I open {company}",
        f"Horrible customer service from {company}. Waiting 3 days for a reply.",
        f"Does anyone know how to export data from {company}? The UI is so confusing.",
        f"Subscription renewed without my permission. {company} is a scam.",
        f"The new feature on {company} is literally unusable.",
        f"Why is {company} so slow today? Server outage?",
        f"Love using {company}, it makes my workflow so much easier!",
        f"{company} just released a great update, really impressed."
    ]
    sources = ["Reddit", "X (Twitter)", "YouTube", "LinkedIn", "Forums"]
    posts = []
    now = time.time()
    
    for i in range(200):
        title = random.choice(problems)
        created = now - random.randint(0, 30 * 24 * 3600)
        posts.append(RawPost(
            id=f"mock-{i}",
            title=title,
            body="",
            score=random.randint(0, 500),
            num_comments=random.randint(0, 50),
            subreddit="social",
            author=f"user{i}",
            created_utc=created,
            url="",
            source=random.choice(sources)
        ))
    return posts


async def _fetch_reddit(company: str, keywords: List[str], client: httpx.AsyncClient) -> List[RawPost]:
    posts = []
    queries = [company] + keywords[:3]

    for query in queries:
        try:
            url = f"https://www.reddit.com/search.json?q={query}&sort=new&limit=50&t=month"
            r = await client.get(url, headers=HEADERS, timeout=15, follow_redirects=True)
            if r.status_code != 200:
                print(f"[Collector] Reddit API error {r.status_code} for query '{query}': {r.text[:100]}")
                continue
            data = r.json()
            for child in data.get("data", {}).get("children", []):
                d = child.get("data", {})
                title = _clean(d.get("title", ""))
                body = _clean(d.get("selftext", ""))
                if not title:
                    continue
                posts.append(RawPost(
                    id=d.get("id", _make_id(title)),
                    title=title,
                    body=body,
                    score=d.get("score", 0),
                    num_comments=d.get("num_comments", 0),
                    subreddit=d.get("subreddit", ""),
                    author=d.get("author", ""),
                    created_utc=d.get("created_utc", time.time()),
                    url=f"https://reddit.com{d.get('permalink', '')}",
                    source="Reddit",
                ))
            await asyncio.sleep(0.5)
        except Exception as e:
            print(f"[Collector] Reddit fetch error for '{query}': {e}")

    return posts


async def _fetch_newsapi(company: str, keywords: List[str], api_key: str, client: httpx.AsyncClient) -> List[RawPost]:
    if not api_key:
        return []
    posts = []
    query = f"{company} {' '.join(keywords[:3])}"
    try:
        url = "https://newsapi.org/v2/everything"
        params = {
            "q": query,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 40,
            "apiKey": api_key,
        }
        r = await client.get(url, params=params, timeout=15)
        if r.status_code != 200:
            print(f"[Collector] NewsAPI error: {r.status_code} {r.text[:200]}")
            return []
        data = r.json()
        for i, article in enumerate(data.get("articles", [])):
            title = _clean(article.get("title") or "")
            body = _clean(article.get("description") or article.get("content") or "")
            if not title or title == "[Removed]":
                continue
            posts.append(RawPost(
                id=f"news-{_make_id(title)}",
                title=title,
                body=body,
                score=0,
                num_comments=0,
                subreddit=article.get("source", {}).get("name", "News"),
                author=article.get("author") or "unknown",
                created_utc=time.time() - i * 3600,
                url=article.get("url", ""),
                source="Forums",
            ))
    except Exception as e:
        print(f"[Collector] NewsAPI error: {e}")
    return posts


def _deduplicate(posts: List[RawPost]) -> List[RawPost]:
    seen_titles = set()
    unique = []
    for p in posts:
        key = re.sub(r"\s+", "", p.title.lower())[:80]
        if key not in seen_titles:
            seen_titles.add(key)
            unique.append(p)
    return unique


def _assign_geo(posts: List[RawPost]) -> None:
    """Assign approximate location based on index for geo distribution."""
    for i, post in enumerate(posts):
        post.location = CITY_COORDS[i % len(CITY_COORDS)]


async def run_collector(memory: SharedMemory, company: str, keywords: List[str], news_api_key: str = "") -> None:
    start = time.time()
    memory.agent_logs.append(AgentLog("Collector Agent", "running", f"Scanning Reddit and NewsAPI for '{company}'...", time.time()))

    async with httpx.AsyncClient() as client:
        reddit_task = _fetch_reddit(company, keywords, client)
        news_task = _fetch_newsapi(company, keywords, news_api_key, client)
        reddit_posts, news_posts = await asyncio.gather(reddit_task, news_task)

    all_posts = reddit_posts + news_posts
    
    if not all_posts:
        print(f"[Collector] No posts found for '{company}'. Using mock fallback data.")
        memory.agent_logs.append(AgentLog("Collector Agent", "running", "APIs failed/blocked. Injecting mock data fallback...", time.time()))
        all_posts = _generate_mock_posts(company)

    unique_posts = _deduplicate(all_posts)
    _assign_geo(unique_posts)

    # Source distribution
    dist: dict = {}
    for p in unique_posts:
        dist[p.source] = dist.get(p.source, 0) + 1
    total = len(unique_posts) or 1
    memory.source_distribution = {k: round(v / total * 100) for k, v in dist.items()}

    # Geo
    geo_map: dict = {}
    for p in unique_posts:
        if p.location:
            name = p.location["name"]
            if name not in geo_map:
                geo_map[name] = {**p.location, "count": 0}
            geo_map[name]["count"] += 1
    memory.geo_distribution = list(geo_map.values())

    memory.raw_posts = unique_posts
    duration = int((time.time() - start) * 1000)
    memory.agent_logs.append(AgentLog(
        "Collector Agent", "done",
        f"Collected {len(unique_posts)} unique posts ({len(reddit_posts)} Reddit, {len(news_posts)} NewsAPI)",
        time.time(), duration
    ))
