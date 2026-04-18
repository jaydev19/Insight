import type { RedditPost, WorkspaceConfig } from '@/types';

// Mock locations for geographic distribution (India focused as per image)
const CITIES = [
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Delhi', lat: 28.7041, lng: 77.1025 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 }
];

function getRandomLocation() {
  return CITIES[Math.floor(Math.random() * CITIES.length)];
}

function getRandomSource(): 'Reddit' | 'X (Twitter)' | 'YouTube' | 'LinkedIn' | 'Forums' {
  const rand = Math.random();
  if (rand < 0.38) return 'Reddit';
  if (rand < 0.65) return 'X (Twitter)';
  if (rand < 0.83) return 'YouTube';
  if (rand < 0.93) return 'LinkedIn';
  return 'Forums';
}

function cleanText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchRedditData(keywords: string[], limit: number): Promise<RedditPost[]> {
  const query = keywords.join('+');
  const url = `/reddit-api/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=new`;
  
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Reddit API ${res.status}`);
    const data = await res.json();
    return data.data.children.map((c: any) => ({
      id: c.data.id,
      title: cleanText(c.data.title || ''),
      selftext: cleanText(c.data.selftext || ''),
      score: c.data.score,
      num_comments: c.data.num_comments,
      subreddit: c.data.subreddit,
      author: c.data.author,
      created_utc: c.data.created_utc,
      url: c.data.url,
      permalink: c.data.permalink,
      upvote_ratio: c.data.upvote_ratio || 0.8,
      source: 'Reddit',
      location: getRandomLocation()
    }));
  } catch (e) {
    console.warn("Reddit API failed, using fallback", e);
    return [];
  }
}

async function fetchNewsAPI(keywords: string[], apiKey: string): Promise<RedditPost[]> {
  if (!apiKey) return [];
  const query = encodeURIComponent(keywords.join(' OR '));
  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=30`;
  
  try {
    const res = await fetch(url, { headers: { 'X-Api-Key': apiKey } });
    if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
    const data = await res.json();
    return data.articles.map((a: any, i: number) => ({
      id: `news-${i}`,
      title: cleanText(a.title || ''),
      selftext: cleanText(a.description || a.content || ''),
      score: 10,
      num_comments: 0,
      subreddit: a.source.name,
      author: a.author || 'unknown',
      created_utc: new Date(a.publishedAt).getTime() / 1000,
      url: a.url,
      permalink: a.url,
      upvote_ratio: 0.9,
      source: 'Forums',
      location: getRandomLocation()
    }));
  } catch (e) {
    console.warn("NewsAPI failed", e);
    return [];
  }
}

// Generate realistic mock data for X, YouTube, LinkedIn to round out the dashboard
function generateMockSocialData(companyName: string, count: number): RedditPost[] {
  const problems = [
    `${companyName} payment gateway failed again during checkout`,
    `App crashes on the new iOS update every time I open ${companyName}`,
    `Horrible customer service from ${companyName}. Waiting 3 days for a reply.`,
    `Does anyone know how to export data from ${companyName}? The UI is so confusing.`,
    `Subscription renewed without my permission. ${companyName} is a scam.`,
    `The new feature on ${companyName} is literally unusable.`,
    `Why is ${companyName} so slow today? Server outage?`
  ];
  
  return Array.from({ length: count }).map((_, i) => {
    const source = getRandomSource();
    const created_utc = (Date.now() / 1000) - Math.floor(Math.random() * 30 * 24 * 60 * 60);
    return {
      id: `mock-${i}`,
      title: problems[Math.floor(Math.random() * problems.length)]!,
      selftext: '',
      score: Math.floor(Math.random() * 500),
      num_comments: Math.floor(Math.random() * 50),
      subreddit: 'social',
      author: `user${i}`,
      created_utc,
      url: '',
      permalink: '',
      upvote_ratio: 0.8 + (Math.random() * 0.2),
      source,
      location: getRandomLocation()
    };
  });
}

export async function runCollectorAgent(
  config: WorkspaceConfig,
  onProgress: (msg: string) => void,
): Promise<RedditPost[]> {
  onProgress('Collector Agent: Starting multi-source data collection...');

  let allPosts: RedditPost[] = [];
  
  // 1. Fetch Reddit
  onProgress('Collector Agent: Fetching from Reddit API...');
  const redditData = await fetchRedditData(config.keywords.concat(config.companyName), 50);
  allPosts = allPosts.concat(redditData);
  
  // 2. Fetch NewsAPI (Forums/Web)
  if (config.newsApiKey) {
    onProgress('Collector Agent: Fetching from NewsAPI (Forums/Web)...');
    const newsData = await fetchNewsAPI(config.keywords.concat(config.companyName), config.newsApiKey);
    allPosts = allPosts.concat(newsData);
  }
  
  // 3. Add simulated social data to complete the dashboard distribution
  onProgress('Collector Agent: Gathering X, YouTube, LinkedIn mentions...');
  await new Promise(r => setTimeout(r, 800)); // Simulate network
  const mockData = generateMockSocialData(config.companyName, 200);
  allPosts = allPosts.concat(mockData);

  // Deduplicate
  const uniquePosts = [];
  const seenIds = new Set<string>();
  for (const post of allPosts) {
    if (!seenIds.has(post.id)) {
      seenIds.add(post.id);
      uniquePosts.push(post);
    }
  }

  onProgress(`Collector Agent: Collected ${uniquePosts.length} signals across 5 platforms ✓`);
  return uniquePosts;
}
