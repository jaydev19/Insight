# Insight

**Insight** is a multi-agent intelligence platform for analyzing social and product signals, combining a FastAPI backend with a TypeScript/Vite-powered frontend. It enables rapid, AI-driven analysis of user sentiment, product risks, and market opportunities from sources like Reddit, Twitter, and more.

---

## Features

- **Multi-Agent Pipeline:** Modular agents for data collection, sentiment analysis, clustering, risk detection, opportunity mining, and strategic insight generation.
- **Hybrid AI:** Uses both rule-based and LLM-powered (Gemini API) approaches for robust, explainable insights.
- **Modern Frontend:** Interactive dashboard built with TypeScript, Vite, and D3.js for visualization.
- **Extensible:** Easily add new agents or data sources.

---

## Project Structure

```
backend/
  main.py           # FastAPI app, API endpoints for analysis and reports
  memory.py         # Shared memory and data models
  agents/           # Python agent implementations (insight, risk, opportunity, etc.)
  runs/             # Saved analysis runs (JSON)
Insight/
  index.html        # Frontend entry point
  package.json      # Frontend dependencies and scripts
  src/              # TypeScript source code (agents, orchestrator, services, types)
	 agents/         # Frontend agent logic (mirrors backend)
	 services/       # Storage and API service logic
	 styles/         # CSS styles
	 types/          # Shared TypeScript types
```

---

## Backend (Python/FastAPI)

- **Endpoints:**
  - `POST /analyze` — Run the full intelligence pipeline
  - `GET /runs` — List saved analysis runs
  - `GET /report/{id}` — Retrieve a specific analysis report
- **Key Dependencies:** FastAPI, scikit-learn, numpy, vaderSentiment, google-generativeai

---

## Frontend (TypeScript/Vite)

- **Main UI:** Configure analysis, run pipeline, and visualize results.
- **Agents:** Each agent (collector, sentiment, cluster, etc.) is implemented in TypeScript for in-browser or API-driven analysis.
- **Visualization:** Uses D3.js for interactive charts and cluster visualizations.

---

## Setup

### Backend

1. **Install dependencies:**
	```bash
	pip install -r backend/requirements.txt
	```
2. **Run the server:**
	```bash
	uvicorn backend.main:app --reload
	```

### Frontend

1. **Install dependencies:**
	```bash
	cd Insight
	npm install
	```
2. **Start the dev server:**
	```bash
	npm run dev
	```

---

## Configuration

- **API Keys:** Enter Gemini and NewsAPI keys in the frontend UI for enhanced analysis.
- **Custom Agents:** Add or modify agents in both backend (`backend/agents/`) and frontend (`Insight/src/agents/`).

---

## Example Usage

1. Enter target company, industry, and keywords in the UI.
2. Provide API keys if available.
3. Click "Run Intelligence Pipeline" to start analysis.
4. View results, clusters, risks, and opportunities in the dashboard.

---

## License

MIT License

---