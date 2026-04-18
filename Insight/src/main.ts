import './styles/main.css';
import * as d3 from 'd3';

const appDiv = document.getElementById('app');
if (!appDiv) throw new Error('No #app element found');

appDiv.innerHTML = `
  <div class="app-container">
    <div class="main-layout">
      <!-- Config Sidebar -->
      <aside class="sidebar-config">
        <div style="font-weight: 800; font-size: 16px; margin-bottom: 20px; color: var(--accent);">
          Insight <span style="font-size: 10px; color: var(--text-muted); font-weight: normal; text-transform: uppercase;">R&D Edition</span>
        </div>
        
        <div class="form-group">
          <label class="form-label">Target Company / Product</label>
          <input type="text" id="cfg-company" class="form-input" value="Zepto" />
        </div>
        <div class="form-group">
          <label class="form-label">Industry</label>
          <input type="text" id="cfg-industry" class="form-input" value="Quick Commerce" />
        </div>
        <div class="form-group">
          <label class="form-label">Tracked Keywords</label>
          <input type="text" id="cfg-keywords" class="form-input" value="refund, delivery, payment" />
        </div>
        
        <hr style="border: 0; border-top: 1px solid var(--border); margin: 20px 0;" />
        
        <div class="form-group">
          <label class="form-label">Gemini API Key (Insights)</label>
          <input type="password" id="cfg-gemini" class="form-input" placeholder="AIza..." />
        </div>
        <div class="form-group">
          <label class="form-label">NewsAPI Key (Web/Forums)</label>
          <input type="password" id="cfg-newsapi" class="form-input" placeholder="Optional" />
        </div>

        <button id="btn-analyze" class="btn-primary" style="margin-top: 15px;">Run Intelligence Pipeline</button>
        
        <div id="status-box" style="margin-top: 20px; font-size: 12px; color: var(--text-secondary);">
          Ready to collect data.
        </div>
      </aside>

      <!-- Dashboard -->
      <main class="dashboard-area">
        <div id="dashboard-content">
          <!-- Will be injected by JS -->
          <div style="text-align: center; color: var(--text-muted); margin-top: 100px;">
            Configure parameters and click "Run Intelligence Pipeline" to populate the dashboard.
          </div>
        </div>
      </main>
    </div>
    
    <!-- Footer -->
    <footer style="height: 30px; background: white; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; font-size: 10px; color: var(--text-muted);">
      <div>
        <span style="color: var(--success);">●</span> Live - updating every 15 min &nbsp;&nbsp;|&nbsp;&nbsp; <span id="foot-mentions">0</span> mentions indexed
      </div>
      <div>TrendSphere Analytics — Enterprise R&D Edition</div>
    </footer>
  </div>
`;

const btnAnalyze = document.getElementById('btn-analyze') as HTMLButtonElement;
const statusBox = document.getElementById('status-box')!;
const dashboardContent = document.getElementById('dashboard-content')!;
const footMentions = document.getElementById('foot-mentions')!;

btnAnalyze.addEventListener('click', async () => {
  const reqBody = {
    company: (document.getElementById('cfg-company') as HTMLInputElement).value,
    industry: (document.getElementById('cfg-industry') as HTMLInputElement).value,
    keywords: (document.getElementById('cfg-keywords') as HTMLInputElement).value.split(',').map(s => s.trim()),
    gemini_api_key: (document.getElementById('cfg-gemini') as HTMLInputElement).value,
    news_api_key: (document.getElementById('cfg-newsapi') as HTMLInputElement).value,
  };

  btnAnalyze.disabled = true;
  btnAnalyze.textContent = 'Pipeline Running...';
  
  dashboardContent.innerHTML = `
    <div style="text-align: center; margin-top: 50px; font-size: 16px; color: var(--text-secondary);">
      <div style="margin-bottom: 20px;" id="pipe-msg">Calling Backend Intelligence Pipeline...</div>
      <div style="width: 300px; height: 6px; background: var(--border); border-radius: 3px; margin: 0 auto; overflow: hidden;">
        <div id="pipe-prog" style="height: 100%; width: 50%; background: var(--blue-indicator); animation: pulse 1s infinite alternate;"></div>
      </div>
      <style>
        @keyframes pulse {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      </style>
    </div>
  `;

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API Error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    renderDashboard(data);
  } catch (e) {
    statusBox.innerHTML = `<span style="color: red;">Error: ${String(e)}</span>`;
    dashboardContent.innerHTML = `<div style="padding: 20px; color: red;">Analysis Failed: ${String(e)}</div>`;
  } finally {
    btnAnalyze.disabled = false;
    btnAnalyze.textContent = 'Run Intelligence Pipeline';
  }
});

function renderDashboard(data: any) {
  const m = data;
  footMentions.textContent = (m.kpis.mentions_tracked || 0).toLocaleString();
  const criticalCount = m.kpis.critical_alerts || 0;
  
  const html = `
    <div class="dashboard-header">
      <div class="kpi-card">
        <div class="kpi-title">Active Signals</div>
        <div class="kpi-val">${m.kpis.active_signals}</div>
        <div class="kpi-sub"><span class="trend-up">▲ 8</span> vs last period</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Critical Alerts</div>
        <div class="kpi-val">${criticalCount < 10 ? '0'+criticalCount : criticalCount}</div>
        <div class="kpi-sub"><span class="trend-down">▲ 2</span> needs action</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Mentions Tracked</div>
        <div class="kpi-val">${(m.kpis.mentions_tracked / 1000).toFixed(1)}K</div>
        <div class="kpi-sub"><span class="trend-up">▲ 12.4%</span> 30-day growth</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Validated Problems</div>
        <div class="kpi-val">${m.kpis.validated_problems}</div>
        <div class="kpi-sub"><span class="trend-up">▲ 5</span> this week</div>
      </div>
    </div>

    ${m.executive_summary ? `
    <div style="margin-bottom: 15px; padding: 15px; background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 8px;">
      <h3 style="margin-bottom: 5px; color: #0369a1;">Executive Summary ${m.executive_summary.is_ai_generated ? '✨ (AI Generated)' : ''}</h3>
      <p style="font-size: 14px; color: #075985;"><strong>Headline:</strong> ${m.executive_summary.headline}</p>
      <div style="display: flex; gap: 15px; margin-top: 10px;">
        <div style="flex: 1; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.3);">
          <strong style="color: var(--danger); font-size: 12px; display: block; margin-bottom: 4px;">Top Risk</strong>
          <span style="font-size: 13px;">${m.executive_summary.top_risk}</span>
        </div>
        <div style="flex: 1; padding: 10px; background: rgba(16, 185, 129, 0.1); border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.3);">
          <strong style="color: var(--success); font-size: 12px; display: block; margin-bottom: 4px;">Top Opportunity</strong>
          <span style="font-size: 13px;">${m.executive_summary.top_opportunity}</span>
        </div>
      </div>
      <div style="margin-top: 10px;">
        ${m.executive_summary.insights.map((ins: any) => `
          <div style="margin-bottom: 5px; font-size: 13px; color: var(--text-primary);">
             <strong>[${ins.type.toUpperCase()}] ${ins.title}</strong>: ${ins.body}
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="dashboard-grid">
      <div class="charts-area">
        <div class="chart-card">
          <div class="chart-header">
            <div>
              <div class="chart-title">Problem Cluster Map</div>
              <div class="chart-subtitle">Sized by volume · Colored by severity</div>
            </div>
            <button style="font-size: 10px; padding: 2px 6px; border: 1px solid var(--border); background: white; border-radius: 4px;">Export</button>
          </div>
          <div class="chart-body" id="chart-bubble"></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div>
              <div class="chart-title">Signal Velocity — 30 Days</div>
              <div class="chart-subtitle">Daily mention volume by severity tier</div>
            </div>
            <button style="font-size: 10px; padding: 2px 6px; border: 1px solid var(--border); background: white; border-radius: 4px;">Export</button>
          </div>
          <div class="chart-body" id="chart-line"></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div>
              <div class="chart-title">Problem Volume by Platform</div>
              <div class="chart-subtitle">30-day signal count per source</div>
            </div>
          </div>
          <div class="chart-body" id="chart-bar"></div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <div>
              <div class="chart-title">30-Day Problem Density</div>
              <div class="chart-subtitle">Signal intensity by day of week</div>
            </div>
          </div>
          <div class="chart-body" id="chart-heat"></div>
        </div>
      </div>

      <div class="right-panel">
        <div class="right-card">
          <div class="right-title">Problem Signals <span style="background: var(--blue-indicator); color: white; border-radius: 10px; padding: 1px 6px; margin-left: 5px;">${m.signals.length}</span></div>
          <div id="signal-list"></div>
        </div>
        
        <div class="right-card">
          <div class="right-title">Signal Sources</div>
          <div id="source-list"></div>
        </div>

        <div class="right-card">
          <div class="right-title">Geographic Distribution</div>
          <div class="map-container" id="geo-map"></div>
          <div style="text-align: right; font-size: 9px; color: var(--text-muted); margin-top: 5px;">${m.geo_distribution.length} cities · ${m.signals.length} active signals</div>
        </div>
      </div>
    </div>
  `;

  dashboardContent.innerHTML = html;

  // Render Right Panel Lists
  renderSignalList(m.signals);
  renderSourceList(m.platform_distribution);

  // Render D3 Charts
  setTimeout(() => {
    drawBubbleChart(m.clusters);
    drawLineChart(m.trend_data);
    drawBarChart(m.platform_distribution);
    drawHeatmap(m.heatmap);
    drawGeoMap(m.geo_distribution);
  }, 100);
  
  // Show Agent Logs
  statusBox.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">Agent Activity Logs</div>
    <div style="max-height: 150px; overflow-y: auto; font-size: 11px;">
      ${m.agent_logs.map((log: any) => `
        <div style="margin-bottom: 3px;">
          <span style="color: ${log.status === 'error' ? 'red' : (log.status === 'done' ? 'green' : 'blue')}">[${log.status}]</span>
          <strong>${log.agent}</strong>: ${log.message} ${log.duration_ms ? `(${log.duration_ms}ms)` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderSignalList(signals: any[]) {
  const container = document.getElementById('signal-list')!;
  const top2 = signals.slice(0, 2);
  container.innerHTML = top2.map((s: any, i: number) => `
    <div class="signal-item ${s.severity}">
      <div class="signal-idx">0${i+1}</div>
      <div class="signal-desc">
        <div>${s.label}</div>
        <div class="signal-tags">
          <span class="${s.severity === 'critical' ? 'crit' : ''}">${s.severity.charAt(0).toUpperCase() + s.severity.slice(1)}</span>
          <span>${s.category}</span>
          <span>${s.top_source}</span>
        </div>
      </div>
      <div class="signal-score">${s.score}</div>
    </div>
  `).join('');
}

function renderSourceList(sources: Record<string, number>) {
  const container = document.getElementById('source-list')!;
  
  const sList = [
    { name: 'Reddit', key: 'Reddit', class: 'reddit', char: 'r/' },
    { name: 'X (Twitter)', key: 'X (Twitter)', class: 'x', char: 'X' },
    { name: 'YouTube', key: 'YouTube', class: 'youtube', char: '▶' },
    { name: 'LinkedIn', key: 'LinkedIn', class: 'linkedin', char: 'in' },
    { name: 'Forums', key: 'Forums', class: 'forums', char: '✦' }
  ];

  container.innerHTML = sList.map(s => {
    const val = sources[s.key] || 0;
    return `
      <div class="source-item">
        <div class="source-icon ${s.class}">${s.char}</div>
        <div class="source-name">${s.key.split(' ')[0]}</div>
        <div class="source-bar-bg">
          <div class="source-bar-fill" style="width: ${val}%; background: ${s.key === 'Reddit' ? 'var(--blue-indicator)' : (s.key === 'X (Twitter)' ? 'var(--purple-indicator)' : (s.key === 'YouTube' ? 'var(--danger)' : (s.key === 'LinkedIn' ? 'var(--text-muted)' : 'var(--text-primary)')))}"></div>
        </div>
        <div class="source-pct">${val}%</div>
      </div>
    `;
  }).join('');
}

function drawBubbleChart(clusters: any[]) {
  const container = document.getElementById('chart-bubble')!;
  const width = container.clientWidth;
  const height = container.clientHeight || 250;

  const svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height);

  const colors: Record<string, string> = { critical: 'var(--danger)', high: 'var(--warning)', medium: 'var(--blue-indicator)', low: 'var(--success)' };
  
  const data = clusters.slice(0, 6).map((c: any) => ({
    r: Math.max(25, Math.min(50, c.volume * 2)),
    label: c.label.split(' / ')[0].substring(0, 15),
    color: colors[c.avg_sentiment < -0.5 ? 'critical' : c.avg_sentiment < -0.2 ? 'high' : 'medium'] || 'var(--blue-indicator)'
  }));

  const simulation = d3.forceSimulation(data as d3.SimulationNodeDatum[])
    .force('charge', d3.forceManyBody().strength(10))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius((d: any) => d.r + 2));

  const nodes = svg.selectAll('g')
    .data(data)
    .enter().append('g');

  nodes.append('circle')
    .attr('r', d => d.r)
    .attr('fill', d => d.color);

  nodes.append('text')
    .attr('class', 'bubble-text')
    .attr('dy', '.3em')
    .text(d => d.label)
    .call(wrap, 40);

  simulation.on('tick', () => {
    nodes.attr('transform', d => `translate(${(d as any).x},${(d as any).y})`);
  });

  function wrap(text: any, width: number) {
    text.each(function(this: SVGTextElement) {
      const text = d3.select(this);
      const words = text.text().split(/\s+/).reverse();
      let word;
      let line: string[] = [];
      let lineNumber = 0;
      const lineHeight = 1.1;
      const y = text.attr("y");
      const dy = parseFloat(text.attr("dy") || "0");
      let tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
      while (word = words.pop()) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node()!.getComputedTextLength() > width) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
        }
      }
    });
  }
}

function drawLineChart(data: any[]) {
  const container = document.getElementById('chart-line')!;
  const width = container.clientWidth;
  const height = container.clientHeight || 250;
  const margin = { top: 20, right: 20, bottom: 30, left: 30 };

  const svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height);

  const x = d3.scaleLinear().domain([0, 29]).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d: any) => d.count) || 200]).range([height - margin.bottom, margin.top]);

  const lineAll = d3.line<any>()
    .x((d, i) => x(i))
    .y(d => y(d.count))
    .curve(d3.curveMonotoneX);

  const lineCrit = d3.line<any>()
    .x((d, i) => x(i))
    .y(d => y(d.critical_count))
    .curve(d3.curveMonotoneX);

  const areaCrit = d3.area<any>()
    .x((d, i) => x(i))
    .y0(y(0))
    .y1(d => y(d.critical_count))
    .curve(d3.curveMonotoneX);

  svg.append('path').datum(data).attr('class', 'area-critical').attr('d', areaCrit);
  svg.append('path').datum(data).attr('class', 'line-all').attr('d', lineAll);
  svg.append('path').datum(data).attr('class', 'line-critical').attr('d', lineCrit);

  const xAxis = d3.axisBottom(x).ticks(5).tickFormat(() => '');
  const yAxis = d3.axisLeft(y).ticks(4).tickFormat(() => 'HIGH');
  
  svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).attr('class', 'axis').call(xAxis);
  svg.append('g').attr('transform', `translate(${margin.left},0)`).attr('class', 'axis').call(yAxis);
  
  svg.append('text').attr('x', margin.left).attr('y', margin.top - 5).attr('font-size', '10px').attr('fill', 'var(--text-muted)').text('HIGH');
  svg.append('text').attr('x', margin.left).attr('y', height - margin.bottom - 5).attr('font-size', '10px').attr('fill', 'var(--text-muted)').text('LOW');

  const leg = svg.append('g').attr('transform', `translate(${margin.left}, ${height - 10})`);
  leg.append('line').attr('x1', 0).attr('x2', 15).attr('stroke', 'var(--danger)').attr('stroke-width', 2);
  leg.append('text').attr('x', 20).attr('y', 4).attr('font-size', '10px').attr('fill', 'var(--text-muted)').text('Critical signals');
  leg.append('line').attr('x1', 100).attr('x2', 115).attr('stroke', 'var(--blue-indicator)').attr('stroke-width', 2).attr('stroke-dasharray', '4');
  leg.append('text').attr('x', 120).attr('y', 4).attr('font-size', '10px').attr('fill', 'var(--text-muted)').text('All signals');
}

function drawBarChart(sources: Record<string, number>) {
  const container = document.getElementById('chart-bar')!;
  const width = container.clientWidth;
  const height = container.clientHeight || 250;
  const margin = { top: 20, right: 20, bottom: 40, left: 30 };

  const svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height);

  const data = [
    { name: 'Reddit', val: sources['Reddit'] || 0, col: 'var(--blue-indicator)' },
    { name: 'X', val: sources['X (Twitter)'] || 0, col: 'var(--purple-indicator)' },
    { name: 'YouTube', val: sources['YouTube'] || 0, col: 'var(--danger)' },
    { name: 'LinkedIn', val: sources['LinkedIn'] || 0, col: 'var(--warning)' },
    { name: 'Forums', val: sources['Forums'] || 0, col: 'var(--success)' }
  ];

  const x = d3.scaleBand().domain(data.map(d => d.name)).range([margin.left, width - margin.right]).padding(0.8);
  const y = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);

  svg.selectAll('.bar')
    .data(data)
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('x', d => x(d.name)!)
    .attr('y', d => y(d.val))
    .attr('width', x.bandwidth())
    .attr('height', d => height - margin.bottom - y(d.val))
    .attr('fill', d => d.col);

  svg.selectAll('.label-txt')
    .data(data)
    .enter().append('text')
    .attr('x', d => x(d.name)! + x.bandwidth()/2)
    .attr('y', height - margin.bottom + 15)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', 'var(--text-muted)')
    .text(d => d.name);
    
  svg.selectAll('.val-txt')
    .data(data)
    .enter().append('text')
    .attr('x', d => x(d.name)! + x.bandwidth()/2)
    .attr('y', d => y(d.val) - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('font-weight', 'bold')
    .attr('fill', d => d.col)
    .text(d => d.val + '%');
}

function drawHeatmap(data: any[]) {
  const container = document.getElementById('chart-heat')!;
  const width = container.clientWidth;
  const height = container.clientHeight || 250;
  const margin = { top: 20, right: 20, bottom: 40, left: 30 };

  const svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5'];

  const x = d3.scaleBand().domain(days).range([margin.left, width - margin.right]).padding(0.05);
  const y = d3.scaleBand().domain(weeks).range([margin.top, height - margin.bottom]).padding(0.05);
  
  const colorScale = d3.scaleLinear<string>().domain([0, 100]).range(['#eff6ff', '#1d4ed8']);

  svg.selectAll('rect')
    .data(data)
    .enter().append('rect')
    .attr('x', d => x(d.day)!)
    .attr('y', d => y(d.week)!)
    .attr('width', x.bandwidth())
    .attr('height', y.bandwidth())
    .attr('fill', d => colorScale(d.value))
    .attr('rx', 2);

  svg.selectAll('.x-label')
    .data(days).enter().append('text')
    .attr('x', d => x(d)! + x.bandwidth()/2)
    .attr('y', margin.top - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', 'var(--text-muted)')
    .text(d => d);

  svg.selectAll('.y-label')
    .data(weeks).enter().append('text')
    .attr('x', margin.left - 5)
    .attr('y', d => y(d)! + y.bandwidth()/2 + 3)
    .attr('text-anchor', 'end')
    .attr('font-size', '10px')
    .attr('fill', 'var(--text-muted)')
    .text(d => d);
}

function drawGeoMap(locations: any[]) {
  const container = document.getElementById('geo-map')!;
  const width = container.clientWidth;
  const height = container.clientHeight || 150;

  const svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height);

  const x = d3.scaleLinear().domain([68, 97]).range([0, width]);
  const y = d3.scaleLinear().domain([8, 37]).range([height, 0]);

  svg.selectAll('circle')
    .data(locations)
    .enter().append('circle')
    .attr('cx', d => x(d.lng))
    .attr('cy', d => y(d.lat))
    .attr('r', d => Math.min(6, Math.max(3, d.count * 1.5)))
    .attr('fill', (d, i) => ['#ef4444', '#3b82f6', '#f59e0b', '#10b981'][i % 4]!);

  svg.selectAll('text')
    .data(locations)
    .enter().append('text')
    .attr('x', d => x(d.lng) + 6)
    .attr('y', d => y(d.lat) + 3)
    .attr('font-size', '8px')
    .attr('fill', 'var(--text-primary)')
    .text(d => d.name);
}
