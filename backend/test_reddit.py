import httpx
import asyncio

async def test():
    async with httpx.AsyncClient() as client:
        r = await client.get('https://www.reddit.com/search.json?q=Apple&limit=5', headers={'User-Agent': 'python:trendsphere.bot:v1.0'}, timeout=15)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            print("Reddit success!")

asyncio.run(test())
