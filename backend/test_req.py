import requests
import json

url = "http://127.0.0.1:8000/analyze"
data = {
    "company": "Apple",
    "industry": "Technology",
    "keywords": ["iPhone", "MacBook"]
}

response = requests.post(url, json=data)
print(response.status_code)
try:
    print(json.dumps(response.json()["agent_logs"], indent=2))
except Exception as e:
    print(response.text)
