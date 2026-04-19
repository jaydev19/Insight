import httpx
import asyncio
import xml.etree.ElementTree as ET

async def test_google_news():
    query = "Apple"
    url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, timeout=15)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            root = ET.fromstring(r.text)
            channel = root.find("channel")
            items = channel.findall("item")
            print(f"Found {len(items)} news items")
            if items:
                print(f"Sample title: {items[0].find('title').text}")
                print(f"Sample pubDate: {items[0].find('pubDate').text}")

asyncio.run(test_google_news())
