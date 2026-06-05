// Source Rack — 信息源管理面板
// Scans wiki/entities/sources/*.md → renders HTML list
const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3098', 10);
const SOURCES_DIR = process.env.SOURCES_DIR || 'D:/Obsidian/wiki/entities/sources';

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)---\n/);
  if (!m) return {};
  const data = {};
  m[1].split('\n').forEach(line => {
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (kv) {
      const val = kv[2].trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        data[kv[1]] = val.slice(1, -1).split(',').map(function(s) { return s.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'); });
      } else {
        data[kv[1]] = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      }
    }
  });
  return data;
}

function scanSources() {
  if (!fs.existsSync(SOURCES_DIR)) return [];
  // Normalize legacy fields: created → added, updated → last_used
  function norm(s) {
    if (!s.added && s.created) s.added = s.created;
    if (!s.last_used && s.updated) s.last_used = s.updated;
    // URL normalization: bare domains → https://  (does not mutate file on disk)
    if (s.url) {
      s._raw_url = s.url;
      var u = s.url.trim();
      if (/^https?:\/\//.test(u)) { /* ok */ }
      else if (/^file:\/\//i.test(u)) { /* keep as-is */ }
      else if (/^(localhost|127\.\d+\.\d+\.\d+|\[\:\:1\]|[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/i.test(u)) { /* local/IP, keep as-is */ }
      else if (/^[\w.-]+\.[a-z]{2,}/i.test(u)) { s.url = 'https://' + u; }
    }
    return s;
  }
  const files = fs.readdirSync(SOURCES_DIR).filter(f => f.endsWith('.md'));
  return files.map(f => {
    const raw = fs.readFileSync(path.join(SOURCES_DIR, f), 'utf8');
    const fm = frontmatter(raw);
    return norm({ file: f, ...fm });
  });
}

const TIER_ORDER = { S: 0, A: 1, block: 2 };

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function badgeClass(tier) {
  const map = { S: 's', A: 'a', block: 'x' };
  return 'tier-' + (map[tier] || 'c');
}

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>信息源管理 — Source Rack</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='4' y='18' width='5' height='10' rx='1' fill='%23002FA7'/%3E%3Crect x='13.5' y='10' width='5' height='18' rx='1' fill='%23002FA7'/%3E%3Crect x='23' y='4' width='5' height='24' rx='1' fill='%23002FA7'/%3E%3Ccircle cx='6.5' cy='6' r='2.5' fill='%23002FA7' opacity='.35'/%3E%3Ccircle cx='16' cy='6' r='2.5' fill='%23002FA7' opacity='.55'/%3E%3Ccircle cx='25.5' cy='6' r='2.5' fill='%23002FA7' opacity='.75'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600&family=Noto+Sans+SC:wght@200;300;400;500;700&display=swap" rel="stylesheet">
<style>
  :root {
    /* Swiss IKB — single accent, flat, 0 radius, 0 shadow */
    --paper: #fafaf8;
    --ink: #0a0a0a;
    --grey-1: #f0f0ee;
    --grey-2: #d4d4d2;
    --grey-3: #737373;
    --accent: #002FA7;
    --accent-on: #ffffff;
    --text-primary: #0a0a0a;
    --text-secondary: #525252;
    --text-helper: #737373;
    --text-placeholder: #a3a3a3;
    --border-subtle: #e0e0e0;
    /* Carbon spacing */
    --sp-3: 8px; --sp-4: 12px; --sp-5: 16px; --sp-6: 24px; --sp-7: 32px; --sp-8: 40px;
    --sans: "Inter", "Helvetica Neue", "Helvetica", "Arial", system-ui, -apple-system, sans-serif;
    --sans-zh: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
    --mono: "JetBrains Mono", "SF Mono", "Cascadia Code", "Consolas", ui-monospace, monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--sans), var(--sans-zh);
    background: var(--paper); color: var(--ink); line-height: 1.5; font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Header ── */
  .topbar {
    padding: var(--sp-7) 5vw var(--sp-6);
    display: flex; align-items: flex-end; justify-content: space-between;
    border-bottom: 2px solid var(--accent);
  }
  .topbar .head-group { display: flex; align-items: center; gap: var(--sp-4); }
  .topbar .logo { flex-shrink: 0; }
  .topbar h1 {
    font-family: var(--sans), var(--sans-zh);
    font-size: 26px; font-weight: 200; letter-spacing: -0.025em;
    color: var(--ink); line-height: 1;
  }
  .topbar .sub {
    font-size: 12px; font-weight: 400; color: var(--text-helper);
    margin-top: 2px; letter-spacing: 0.02em;
  }
  .topbar .tagline {
    font-size: 13px; font-weight: 300; color: var(--text-secondary);
    margin-top: 6px; letter-spacing: 0.01em; font-style: italic;
  }
  .health-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    transition: background 0.3s;
  }
  .health-dot.green { background: #1a7a3a; }
  .health-dot.yellow { background: #d4a017; }
  .health-dot.red { background: #c00; }
  .health-dot.loading { background: var(--text-placeholder); animation: healthPulse 1.2s ease-in-out infinite; }
  @keyframes healthPulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
  .health-checks {
    display: inline-flex; align-items: center; position: relative;
    font-size: 12px; margin-top: 5px;
  }
  .health-checks details { display: inline-flex; }
  .health-checks summary {
    cursor: pointer; list-style: none; display: inline-flex; align-items: center; gap: 4px;
    user-select: none;
  }
  .health-checks summary::-webkit-details-marker { display: none; }
  .health-checks summary .caret { font-size: 8px; color: var(--text-placeholder); transition: transform 0.15s; }
  .health-checks details[open] summary .caret { transform: rotate(90deg); }
  .health-status { color: var(--text-secondary); cursor: default; white-space: nowrap; }
  .health-status .cmd { color: var(--accent); font-weight: 500; }
  .health-checks-list {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 200;
    margin: 0; padding: 10px 14px; background: var(--paper);
    border: 1px solid var(--border-subtle); list-style: none;
    font-size: 11px; line-height: 2; color: var(--text-secondary);
    min-width: 360px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  }
  .health-checks-list .pass { color: #1a7a3a; }
  .health-checks-list .fail { color: #a61b1b; }
  .health-legend {
    margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-subtle);
    font-size: 10px; line-height: 1.7; color: var(--text-helper) !important;
    white-space: nowrap;
  }
  .health-legend b { color: var(--text-secondary); }
  .health-legend .hl-red { color: #a61b1b; }
  .health-legend .hl-yellow { color: #8a6d14; }
  .health-legend .hl-green { color: #1a7a3a; }
  .health-legend .say { background: var(--border-subtle); padding: 0 4px; border-radius: 3px; font-weight: 500; }
  .topbar .search-wrap { display: flex; align-items: center; gap: 0; }
  .topbar .search-wrap input {
    padding: 8px 12px 8px 12px; border: 1px solid var(--border-subtle); border-right: none;
    font-size: 13px; width: 200px; outline: none;
    background: var(--paper); color: var(--ink);
    font-family: var(--sans), var(--sans-zh);
    transition: border-color 0.15s var(--ease-prod, cubic-bezier(.2,0,.38,.9));
  }
  .topbar .search-wrap input:focus { border-color: var(--accent); }
  .topbar .search-wrap input:focus + .search-btn { border-color: var(--accent); }
  .topbar .search-wrap input::placeholder { color: var(--text-placeholder); }
  .search-btn {
    padding: 8px 10px; border: 1px solid var(--border-subtle); border-left: none;
    background: var(--paper); color: var(--text-helper); cursor: pointer;
    font-size: 14px; line-height: 1;
    transition: border-color 0.15s var(--ease-prod, cubic-bezier(.2,0,.38,.9));
  }
  .search-btn:hover { color: var(--accent); }
  .topbar .search-wrap::before {
    content: "⌕"; position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
    font-size: 14px; color: var(--text-placeholder); pointer-events: none;
  }

  /* ── Container ── */
  .container { max-width: 1600px; margin: 0 auto; padding: var(--sp-6) 5vw; }

  /* ── Filters ── */
  .filter-panel { margin-bottom: var(--sp-6); }
  .filter-row {
    display: flex; align-items: center; gap: var(--sp-4);
    padding: var(--sp-3) 0 28px; flex-wrap: wrap; overflow-x: visible;
    scrollbar-width: none; -ms-overflow-style: none;
  }
  .filter-row::-webkit-scrollbar { display: none; }
  .filter-row:last-of-type { padding-bottom: var(--sp-3); }
  .filter-row-label {
    font-size: 11px; font-weight: 600; color: var(--text-helper);
    text-transform: uppercase; letter-spacing: 0.06em;
    min-width: 32px; flex-shrink: 0;
  }
  .chip {
    padding: 5px 13px; font-size: 13px; font-weight: 500;
    background: var(--paper); border: 1px solid var(--border-subtle); cursor: pointer;
    transition: all 0.12s; user-select: none; white-space: nowrap;
    color: var(--text-secondary); display: inline-flex; align-items: center; gap: 5px;
  }
  .domain-icon { display: inline-flex; align-items: center; flex-shrink: 0; color: var(--accent); }
  .chip.active .domain-icon { color: var(--accent-on); }
  .chip.parent-active .domain-icon { color: var(--accent); }
  .domain-icon svg { display: block; }
  .chip:hover { border-color: var(--grey-3); color: var(--ink); }
  .chip.active { background: var(--accent); color: var(--accent-on); border-color: var(--accent); }
  .chip.parent-active { border-color: var(--accent); color: var(--accent); }
  .chip.dim { opacity: 0.3; pointer-events: none; }
  .chip strong { font-weight: 600; }
  /* tooltip — positioned above chip, out of flow */
  .chip[data-tip] { position: relative; }
  .chip[data-tip]:hover::after {
    content: attr(data-tip);
    position: absolute; bottom: calc(100% + 6px); left: 50%;
    transform: translateX(-50%);
    background: var(--ink); color: #fff;
    padding: 6px 12px; font-size: 12px; line-height: 1.5;
    white-space: nowrap; z-index: 999; pointer-events: none;
  }
  .domain-sep {
    padding: 4px 2px; font-size: 10px; color: var(--text-placeholder);
    user-select: none; align-self: center;
  }

  .count-badge {
    margin-left: auto; font-size: 12px; color: var(--text-helper);
    padding: 4px 0; white-space: nowrap;
  }

  /* ── List ── */
  .list { border: 1px solid var(--border-subtle); }
  .list-h {
    display: grid; grid-template-columns: 52px 150px 1fr 100px 140px 220px;
    padding: 11px var(--sp-5); border-bottom: 1px solid var(--ink);
    background: var(--ink); font-size: 11px; font-weight: 600;
    color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: 0.06em;
    align-items: center; gap: var(--sp-4);
  }
  .row {
    display: grid; grid-template-columns: 52px 150px 1fr 100px 140px 220px;
    padding: 13px var(--sp-5); border-bottom: 1px solid var(--border-subtle);
    align-items: center; gap: var(--sp-4); transition: background 0.1s;
  }
  .row:last-child { border-bottom: none; }
  .row:hover { background: var(--grey-1); }
  .row.hidden { display: none; }
  .row.stale { opacity: 0.5; }
  .row.stale:hover { opacity: 0.85; }
  .stale-badge {
    display: inline-block; margin-left: 8px; padding: 1px 7px; font-size: 10px;
    font-weight: 500; color: var(--text-placeholder); border: 1px solid var(--border-subtle);
    vertical-align: middle;
  }
  .stale-badge.warm { color: #b45309; border-color: #fdba74; }

  /* ── Tier badge ── */
  .tier-badge {
    width: 30px; height: 30px; font-weight: 600; font-size: 13px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    font-family: var(--sans);
  }
  .tier-s { background: none; color: var(--ink); border: 1px solid var(--ink); }
  .tier-a { background: none; color: var(--text-secondary); border: 1px solid var(--border-subtle); }
  .tier-x { background: none; color: #c00; border: 1px solid #c00; }

  /* ── Cell chips: domain / type / strategy / tag — all chip-style ── */
  .cell-chip {
    display: inline-block; padding: 3px 10px; font-size: 12px; font-weight: 500;
    border: 1px solid var(--border-subtle); color: var(--text-secondary);
    white-space: nowrap; cursor: default;
  }
  .cell-chip.clickable { cursor: pointer; }
  .cell-chip.clickable:hover { border-color: var(--accent); color: var(--accent); background: none; }
  .cell-chip.muted { color: var(--text-helper); }

  .domain-badge { margin-right: 4px; margin-bottom: 3px; }
  .domain-cell { display: flex; flex-wrap: nowrap; gap: 0; overflow: hidden; }
  .src-type { margin-right: 4px; }
  .tag {
    display: inline-block; padding: 3px 10px; font-size: 12px; font-weight: 500;
    border: 1px solid var(--border-subtle); color: var(--text-secondary);
    white-space: nowrap; margin-right: 4px; margin-bottom: 3px;
  }
  .tag.clickable { cursor: pointer; }
  .tag.clickable:hover { background: var(--accent); color: var(--accent-on); border-color: var(--accent); }
  .tag-cell { display: flex; flex-wrap: nowrap; gap: 3px; overflow: hidden; }

  /* ── Source info ── */
  .src-name { font-weight: 500; font-size: 14px; color: var(--ink); }
  .src-url, .src-url:visited { font-size: 12px; color: var(--accent); margin-top: 1px; font-family: var(--mono); text-decoration: none; }
  .src-url:hover { color: var(--ink); text-decoration: underline; }
  .favicon { flex-shrink: 0; opacity: 0.85; }

  .empty { padding: 64px; text-align: center; color: var(--text-helper); font-size: 13px; font-weight: 300; }
  .note { margin-top: var(--sp-5); font-size: 11px; color: var(--text-placeholder); padding: 0; letter-spacing: 0.03em; }

  /* ── Principles ── */
  .principles-bar { max-width: 1600px; margin: 0 auto; padding: var(--sp-8) 5vw var(--sp-6); }
  .principles-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: var(--border-subtle); }
  .principle { background: var(--paper); padding: 24px 20px; }
  .principle-num { font-family: var(--mono); font-size: 10px; font-weight: 500; color: var(--accent); opacity: 0.45; margin-bottom: 10px; letter-spacing: 0.04em; }
  .principle-head { font-size: 15px; font-weight: 500; color: var(--ink); margin-bottom: 6px; letter-spacing: -0.01em; line-height: 1.4; }
  .principle-body { font-size: 12px; font-weight: 300; color: var(--text-secondary); line-height: 1.6; }

  /* ── Architecture Flow ── */
  .arch-section { max-width: 1600px; margin: 0 auto; padding: 0 5vw var(--sp-8); }
  .arch-section-label {
    font-size: 11px; font-weight: 600; color: var(--text-helper);
    text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: var(--sp-5);
    display: flex; align-items: center; gap: var(--sp-3);
  }
  .arch-section-label::after {
    content: ""; flex: 1; height: 1px; background: var(--border-subtle);
  }
  .arch-svg { width: 100%; display: block; }
</style>
</head>
<body>

<div class="topbar">
  <div>
    <div class="head-group">
      <svg class="logo" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="18" width="5" height="10" rx="1" fill="var(--accent)"/>
        <rect x="13.5" y="10" width="5" height="18" rx="1" fill="var(--accent)"/>
        <rect x="23" y="4" width="5" height="24" rx="1" fill="var(--accent)"/>
        <circle cx="6.5" cy="6" r="2.5" fill="var(--accent)" opacity="0.35"/>
        <circle cx="16" cy="6" r="2.5" fill="var(--accent)" opacity="0.55"/>
        <circle cx="25.5" cy="6" r="2.5" fill="var(--accent)" opacity="0.75"/>
      </svg>
      <div>
        <h1>信息源管理</h1>
        <div class="sub">Source Rack · SOURCES_PLACEHOLDER_COUNT 个源</div>
        <div class="tagline">策展即权力，分类即导航</div>
        <div class="health-checks" id="healthChecks">
          <details>
            <summary><span id="healthDot" class="health-dot loading"></span><span id="healthStatus" class="health-status">检查中…</span><span class="caret">▸</span></summary>
            <ul id="healthChecksList" class="health-checks-list"></ul>
          </details>
        </div>
      </div>
    </div>
  </div>
  <div class="search-wrap">
    <input type="text" id="searchInput" placeholder="输入关键词即时筛选…" oninput="applyFilters()">
    <button class="search-btn" onclick="applyFilters()" title="筛选">⌕</button>
  </div>
</div>

<div class="container">
  <div class="filter-panel">
    <div class="filter-row">TIER_CHIPS_ROW
    </div>
    <div class="filter-row">
      DOMAIN_TOP_ROW
    </div>
    <div class="filter-row" id="subDomainRow" style="display:none">
      DOMAIN_SUB_ROW
    </div>
    <div class="filter-row">
      <span class="filter-row-label">类型</span>
      <span class="chip active" data-type="all" onclick="setType('all')">全部</span>
    </div>
  </div>

  <div class="list">
    <div class="list-h">
      <div>档位</div><div>领域</div><div>来源</div><div>类型</div><div>搜索策略</div><div>标签</div>
    </div>
    <div id="listBody">SOURCES_PLACEHOLDER_ROWS</div>
  </div>

  <div class="principles-bar">
    <div class="principles-grid">
      <div class="principle">
        <div class="principle-num">01</div>
        <div class="principle-head">文件即真相源</div>
        <div class="principle-body">每个 .md 一个信息源。YAML frontmatter 是唯一数据——没有数据库、没有后台、没有冗余。</div>
      </div>
      <div class="principle">
        <div class="principle-num">02</div>
        <div class="principle-head">分类先于列举</div>
        <div class="principle-body">两级领域分类 + 类型 + 档位。碎片信息不可迁移，框架可以。点 chip 就是在建构检索路径。</div>
      </div>
      <div class="principle">
        <div class="principle-num">03</div>
        <div class="principle-head">策展即权力</div>
        <div class="principle-body">不加 why 不收——收录理由强制必填。每一条策展决定都在定义什么值得被记住。</div>
      </div>
      <div class="principle">
        <div class="principle-num">04</div>
        <div class="principle-head">生长 &gt; 归档</div>
        <div class="principle-body">系统价值 = 策展增量，不 = 文件数量。每次 AI 对话中发现的优质源，零摩擦进入源架。</div>
      </div>
      <div class="principle">
        <div class="principle-num">05</div>
        <div class="principle-head">优胜劣汰</div>
        <div class="principle-body">新陈代谢是活的标志。不用的沉底，404 淘汰，用过的浮上来。只进不出是垃圾场。</div>
      </div>
    </div>
  </div>

  <div class="arch-section">
    <div class="arch-section-label">架构：信息源怎么流动</div>
    <svg viewBox="0 0 1480 340" class="arch-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrowHead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0 0, 10 4, 0 8" fill="#002FA7"/>
        </marker>
        <marker id="arrowFeedback" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0 0, 10 4, 0 8" fill="#999"/>
        </marker>
        <linearGradient id="pillGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#002FA7"/>
          <stop offset="100%" stop-color="#0040c0"/>
        </linearGradient>
      </defs>

      <!-- ====== NODE 1: 发现 (terminator/pill) ====== -->
      <rect x="30" y="75" width="220" height="90" rx="45" fill="url(#pillGrad)" stroke="#002FA7" stroke-width="2"/>
      <text x="140" y="112" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="17" font-weight="700">01 · 发现</text>
      <text x="140" y="135" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="system-ui,sans-serif" font-size="13">AI 对话 / 用户推荐</text>

      <!-- Arrow 1→2 -->
      <line x1="250" y1="120" x2="335" y2="120" stroke="#002FA7" stroke-width="2" marker-end="url(#arrowHead)"/>

      <!-- ====== NODE 2: 收录 (process rect) ====== -->
      <rect x="345" y="75" width="220" height="90" rx="6" fill="#fff" stroke="#002FA7" stroke-width="2"/>
      <rect x="345" y="75" width="6" height="90" rx="3" fill="#002FA7"/>
      <text x="455" y="112" text-anchor="middle" fill="#222" font-family="system-ui,sans-serif" font-size="17" font-weight="700">02 · 收录</text>
      <text x="455" y="135" text-anchor="middle" fill="#666" font-family="system-ui,sans-serif" font-size="13">POST /sources 校验落盘</text>

      <!-- Arrow 2→3 -->
      <line x1="565" y1="120" x2="625" y2="120" stroke="#002FA7" stroke-width="2" marker-end="url(#arrowHead)"/>

      <!-- ====== NODE 3: 存储 (cylinder/data shape) ====== -->
      <path d="M 635,80 A 110,15 0 0,0 855,80 L 855,150 A 110,15 0 0,1 635,150 Z" fill="#f8f9ff" stroke="#002FA7" stroke-width="2"/>
      <ellipse cx="745" cy="80" rx="110" ry="15" fill="#e8ecff" stroke="#002FA7" stroke-width="2"/>
      <text x="745" y="110" text-anchor="middle" fill="#222" font-family="system-ui,sans-serif" font-size="17" font-weight="700">03 · 存储</text>
      <text x="745" y="133" text-anchor="middle" fill="#666" font-family="system-ui,sans-serif" font-size="13">Obsidian .md YAML frontmatter</text>

      <!-- Arrow 3→4 -->
      <line x1="865" y1="120" x2="925" y2="120" stroke="#002FA7" stroke-width="2" marker-end="url(#arrowHead)"/>

      <!-- ====== NODE 4: 查询 (process rect) ====== -->
      <rect x="935" y="75" width="220" height="90" rx="6" fill="#fff" stroke="#002FA7" stroke-width="2"/>
      <rect x="935" y="75" width="6" height="90" rx="3" fill="#002FA7"/>
      <text x="1045" y="112" text-anchor="middle" fill="#222" font-family="system-ui,sans-serif" font-size="17" font-weight="700">04 · 查询</text>
      <text x="1045" y="135" text-anchor="middle" fill="#666" font-family="system-ui,sans-serif" font-size="13">面板过滤 + AI grep 检索</text>

      <!-- Arrow 4→5 -->
      <line x1="1155" y1="120" x2="1215" y2="120" stroke="#002FA7" stroke-width="2" marker-end="url(#arrowHead)"/>

      <!-- ====== NODE 5: 代谢 (process rect) ====== -->
      <rect x="1225" y="75" width="220" height="90" rx="6" fill="#fff" stroke="#002FA7" stroke-width="2"/>
      <rect x="1225" y="75" width="6" height="90" rx="3" fill="#002FA7"/>
      <text x="1335" y="112" text-anchor="middle" fill="#222" font-family="system-ui,sans-serif" font-size="17" font-weight="700">05 · 代谢</text>
      <text x="1335" y="135" text-anchor="middle" fill="#666" font-family="system-ui,sans-serif" font-size="13">last_used 排序 · 沉底淘汰</text>

      <!-- ====== FEEDBACK LOOP: 代谢 → 发现 ====== -->
      <path d="M 1335,165 L 1335,290 L 140,290 L 140,170"
            fill="none" stroke="#999" stroke-width="1.8" stroke-dasharray="8,4"
            marker-end="url(#arrowFeedback)"/>
      <!-- Feedback label -->
      <rect x="660" y="276" width="155" height="28" rx="14" fill="#fff" stroke="#ddd" stroke-width="1"/>
      <text x="737" y="294" text-anchor="middle" fill="#888" font-family="system-ui,sans-serif" font-size="12">反馈循环 · 越用越活</text>

      <!-- ====== LAYER LABELS (below nodes) ====== -->
      <text x="30" y="205" fill="#ccc" font-family="system-ui,sans-serif" font-size="10" text-anchor="start">INPUT</text>
      <text x="345" y="205" fill="#ccc" font-family="system-ui,sans-serif" font-size="10" text-anchor="start">API</text>
      <text x="635" y="205" fill="#ccc" font-family="system-ui,sans-serif" font-size="10" text-anchor="start">VAULT</text>
      <text x="935" y="205" fill="#ccc" font-family="system-ui,sans-serif" font-size="10" text-anchor="start">SURFACE</text>
      <text x="1225" y="205" fill="#ccc" font-family="system-ui,sans-serif" font-size="10" text-anchor="start">DECAY</text>
    </svg>
  </div>

  <div class="note">
    SOURCES_PLACEHOLDER_DIR · frontmatter 驱动 · 每个 .md 一个源
  </div>
</div>

<script>
var tier = 'all', domain = 'all', stype = 'all';
function setTier(t) {
  tier = t;
  document.querySelectorAll('.filter-row .chip[data-tier]').forEach(function(c) {
    c.classList.toggle('active', c.dataset.tier === t);
  });
  applyFilters();
}
function setDomain(d) {
  domain = d;
  // Clear all domain chip states first
  document.querySelectorAll('.filter-row .chip[data-domain]').forEach(function(c) {
    c.classList.remove('active', 'parent-active');
  });
  // Highlight clicked chip
  var clicked = document.querySelector('.filter-row .chip[data-domain="' + d + '"]');
  if (clicked) clicked.classList.add('active');
  // Show 二级 row when a 一级 is selected, show only relevant sub-chips
  var subRow = document.getElementById('subDomainRow');
  var TOP_DOMAINS = ['AI','设计','电商','工具','开发','前端','产品','写作','学习','社区','媒体','参考','搜索'];
  if (d === 'all') {
    if (subRow) {
      subRow.style.display = 'none';
      // Restore global counts
      subRow.querySelectorAll('.sub-chip').forEach(function(c) {
        var gc = c.dataset.globalCount;
        var strong = c.querySelector('strong');
        if (strong && gc) strong.textContent = gc;
      });
    }
  } else if (TOP_DOMAINS.indexOf(d) >= 0) {
    if (subRow) {
      subRow.style.display = 'flex';
      subRow.querySelectorAll('.sub-chip').forEach(function(c) {
        var parents = (c.dataset.parents || '').split(' ');
        if (parents.indexOf(d) >= 0) {
          c.style.display = '';
          // Show per-primary count
          var pcs;
          try { pcs = JSON.parse(c.dataset.parentCounts || '{}'); } catch(e) { pcs = {}; }
          var count = pcs[d] || 0;
          var strong = c.querySelector('strong');
          if (strong) strong.textContent = count;
        } else {
          c.style.display = 'none';
        }
      });
    }
  } else {
    // Secondary domain: highlight parent primary chips, restore global sub-chip counts
    if (subRow) {
      // Restore global counts on all sub-chips
      subRow.querySelectorAll('.sub-chip').forEach(function(c) {
        var gc = c.dataset.globalCount;
        var strong = c.querySelector('strong');
        if (strong && gc) strong.textContent = gc;
      });
      // Find clicked sub-chip to get its parents
      subRow.querySelectorAll('.sub-chip').forEach(function(c) {
        if (c.dataset.domain === d) {
          var parents = (c.dataset.parents || '').split(' ');
          parents.forEach(function(p) {
            var parentChip = document.querySelector('.filter-row .chip[data-domain="' + p + '"]');
            if (parentChip) parentChip.classList.add('parent-active');
          });
        }
      });
    }
  }
  applyFilters();
}
function setType(t) {
  stype = t;
  document.querySelectorAll('.filter-row .chip[data-type]').forEach(function(c) {
    c.classList.toggle('active', c.dataset.type === t);
  });
  applyFilters();
}
function setSearch(q) {
  document.getElementById('searchInput').value = q;
  applyFilters();
}
function applyFilters() {
  var search = (document.getElementById('searchInput').value || '').toLowerCase();
  var visible = 0;
  document.querySelectorAll('.row').forEach(function(r) {
    var t = r.dataset.tier, d = r.dataset.domain, tp = r.dataset.type;
    var text = r.dataset.text || '';
    var match = true;
    if (tier !== 'all' && t !== tier) match = false;
    if (domain !== 'all' && !d.split(' ').includes(domain)) match = false;
    if (stype !== 'all' && tp !== stype) match = false;
    if (search && text.indexOf(search) === -1) match = false;
    r.classList.toggle('hidden', !match);
    if (match) visible++;
  });
  var el = document.getElementById('countDisplay');
  if (el) el.textContent = visible + ' / SOURCES_PLACEHOLDER_COUNT';

  // Update chip badge counts to reflect visible (filtered) set
  var tierAcc = {}, typeAcc = {};
  document.querySelectorAll('.row:not(.hidden)').forEach(function(r) {
    var t = r.dataset.tier, tp = r.dataset.type;
    if (t) tierAcc[t] = (tierAcc[t] || 0) + 1;
    if (tp) typeAcc[tp] = (typeAcc[tp] || 0) + 1;
  });
  document.querySelectorAll('.chip[data-tier]:not([data-tier="all"])').forEach(function(c) {
    var strong = c.querySelector('strong');
    if (strong) strong.textContent = tierAcc[c.dataset.tier] || 0;
  });
  document.querySelectorAll('.chip[data-type]:not([data-type="all"])').forEach(function(c) {
    var strong = c.querySelector('strong');
    if (strong) strong.textContent = typeAcc[c.dataset.type] || 0;
  });
  // Also update domain chip counts from visible rows
  var domainAcc = {};
  document.querySelectorAll('.row:not(.hidden)').forEach(function(r) {
    (r.dataset.domain || '').split(' ').forEach(function(d) { if (d) domainAcc[d] = (domainAcc[d] || 0) + 1; });
  });
  document.querySelectorAll('.chip[data-domain]:not([data-domain="all"])').forEach(function(c) {
    var strong = c.querySelector('strong');
    if (strong) strong.textContent = domainAcc[c.dataset.domain] || 0;
  });
}
document.addEventListener('DOMContentLoaded', function() {
  var el = document.getElementById('countDisplay');
  if (el) el.textContent = 'SOURCES_PLACEHOLDER_COUNT / SOURCES_PLACEHOLDER_COUNT';

  // Health dot + status + checklist
  var dot = document.getElementById('healthDot');
  var statusEl = document.getElementById('healthStatus');
  var checksList = document.getElementById('healthChecksList');
  if (!dot || !statusEl) return;
  fetch('/health').then(function(r) { return r.json(); }).then(function(h) {
    dot.classList.remove('loading');
    var gateBreaks = h.gate_breaks ? h.gate_breaks.length : 0;
    var warnings = h.warnings ? h.warnings.length : 0;
    var total = h.total || 0;

    // Atomic checks
    var allChecks = [
      { label: '文件总数', pass: true, detail: total + ' 个源' },
      { label: 'URL 无重复', pass: true, detail: '0 重复' },
      { label: 'URL 无缺失', pass: true, detail: '0 缺URL' },
      { label: '档位无缺失', pass: true, detail: '0 缺档位' },
      { label: '类型无缺失', pass: true, detail: '0 缺类型' },
      { label: '领域无缺失', pass: true, detail: '0 缺领域' },
      { label: '枚举值合法', pass: true, detail: '0 非法值' },
    ];

    var issueMap = {};
    (h.gate_breaks||[]).concat(h.warnings||[]).forEach(function(iss) { issueMap[iss.rule] = iss; });
    if (issueMap['duplicate_urls']) { allChecks[1].pass = false; allChecks[1].detail = issueMap['duplicate_urls'].count + ' 重复'; }
    if (issueMap['missing_url']) { allChecks[2].pass = false; allChecks[2].detail = issueMap['missing_url'].count + ' 缺URL'; }
    if (issueMap['missing_tier']) { allChecks[3].pass = false; allChecks[3].detail = issueMap['missing_tier'].count + ' 缺档位'; }
    if (issueMap['missing_type']) { allChecks[4].pass = false; allChecks[4].detail = issueMap['missing_type'].count + ' 缺类型'; }
    if (issueMap['empty_domains']) { allChecks[5].pass = false; allChecks[5].detail = issueMap['empty_domains'].count + ' 缺领域'; }
    if (issueMap['invalid_tiers'] || issueMap['invalid_types']) {
      allChecks[6].pass = false;
      var iv = (issueMap['invalid_tiers'] ? issueMap['invalid_tiers'].count : 0) + (issueMap['invalid_types'] ? issueMap['invalid_types'].count : 0);
      allChecks[6].detail = iv + ' 非法值';
    }

    // Dot color + status text (user-facing, with AI invocation hint)
    if (gateBreaks > 0) {
      dot.classList.add('red');
      statusEl.innerHTML = '<span class="cmd">对AI说「修闸门」</span> — ' + gateBreaks + ' 处受损';
    } else if (warnings > 0) {
      dot.classList.add('yellow');
      statusEl.innerHTML = '<span class="cmd">对AI说「标准化」</span> — ' + warnings + ' 处缺漏';
    } else {
      dot.classList.add('green');
      statusEl.textContent = total + ' 源 · 唯一真相源自洽';
    }

    // Build checklist
    if (checksList) {
      var html = '';
      allChecks.forEach(function(c) {
        var cls = c.pass ? 'pass' : 'fail';
        var icon = c.pass ? '✓' : '✗';
        html += '<li class="' + cls + '">' + icon + ' ' + c.label + '：' + c.detail + '</li>';
      });
      html += '<li class="health-legend">';
      html += '<b class="hl-red">●</b> 源架受损（重复URL / 缺URL / 非法值）→ <span class="say">对AI说「修闸门」</span><br>';
      html += '<b class="hl-yellow">●</b> 元数据不全（缺档位 / 缺类型 / 缺领域）→ <span class="say">对AI说「标准化」</span><br>';
      html += '<b class="hl-green">●</b> 唯一真相源自洽，无需操作';
      html += '</li>';
      checksList.innerHTML = html;
    }
  }).catch(function(err) {
    dot.classList.remove('loading');
    dot.classList.add('red');
    statusEl.textContent = '无法连接 — 刷新试试';
  });
});
</script>
</body>
</html>`;

const SERVER_START_SCRIPT = `
const SOURCES_DIR = '${SOURCES_DIR.replace(/\\/g, '\\\\')}';
const TIER_ORDER = { S:0, A:1 };
`;

// ─── Auto-assign secondary domains ───
const TOP_DOMAINS = ['AI','设计','电商','工具','开发','前端','产品','写作','学习','社区','媒体','参考','搜索'];
const topSet = new Set(TOP_DOMAINS);
const AI_PRIORITY = {'语音':10,'视频生成':10,'图像生成':10,'3D':10,'Agent':8,'LLM':8,'代码':6,'API':5,'开发平台':5,'学习资源':3,'资讯':3,'论文':3,'通用搜索':3,'技术社区':1,'自动化':1};

function guessAISecondary(url, title) {
  var t = (title + ' ' + url).toLowerCase();
  if (/agent|a2a|agent2agent|mcp|coze|manus/.test(t)) return 'Agent';
  if (/midjourney|stable.diffusion|dall.e|recraft|comfyui|image|图片|绘画|插画|生成.*图|图.*生成|civitai|krea|leonardo|lovart|faces|即梦|jimeng/.test(t)) return '图像生成';
  if (/sora|runway|video|视频|可灵|kling|pixverse|生成.*视频|花生|剪辑/.test(t)) return '视频生成';
  if (/tts|elevenlabs|speech|voice|语音|数字人|suno|音乐|udio|cosyvoice|豆包语音|yueai|tianyin|天音/.test(t)) return '语音';
  if (/3d|tripo|meshy|三维|模型.*生成/.test(t)) return '3D';
  if (/api|platform|开发|key|token|sdk|console|开放平台|开发者|aistudio|bigmodel|coze|stepone/.test(t)) return '开发平台';
  if (/paper|arxiv|论文|research|huggingface.*paper/.test(t)) return '论文';
  if (/news|日报|热榜|trending|量子位|机器之心|aihot|techcrunch|techmeme|venturebeat|siliconangle|geekwire|marktechpost|theneuron|aimagazine|superhuman/.test(t)) return '资讯';
  if (/course|tutorial|教程|课程|learn|学习|专栏|手册|修炼|指南|docs|notebooklm|gist|aigcreative/.test(t)) return '学习资源';
  if (/llm|gpt|claude|gemini|model|模型|chatgpt|openai|anthropic|deepseek|kimi|qwen|千问|minimax|智谱|bigmodel|openrouter|聚合|monica|x\.ai|xai|perplexity|aimaxhug|葫芦|anygen/.test(t)) return 'LLM';
  if (/code|编程|github|gitlab|npm|开源|cursor|claude.code|vscode|visual.studio|aider|vercel|v0/.test(t)) return '代码';
  if (/tailscale|wsl|vpn|网络|cloudfront/.test(t)) return '开发平台';
  return null;
}

function autoAssignSecondaries(domains, url, title) {
  var result = domains.slice();
  var combined = (title + ' ' + url).toLowerCase();
  if (result.indexOf('AI') >= 0) { var s = guessAISecondary(url, title); if (s && result.indexOf(s) < 0) result.push(s); }
  if (result.indexOf('设计') >= 0) {
    if (/awwward|behance|pinterest|dribbble|inspiration|灵感|站酷|zcool|agent002|artofthetitle|illustration|插画/.test(combined) && result.indexOf('设计灵感') < 0) result.push('设计灵感');
    else if (/谷德|gooood|archdaily|室内|interior|yellowtrace|知末|awhouse|barragan|巴拉干/.test(combined) && result.indexOf('室内设计') < 0) result.push('室内设计');
    else if (/3d66|3d.*素材|三维.*素材|模型.*素材/.test(combined) && result.indexOf('3D素材') < 0) result.push('3D素材');
    else if (/html5.*up|tooplate|template|模板|v0|vercel.*v0/.test(combined) && result.indexOf('网页设计') < 0) result.push('网页设计');
    else if (/mobbin|ios.*app|ui.*kit/.test(combined) && result.indexOf('UI/UX') < 0) result.push('UI/UX');
    else if (/coolors|color|色彩|配色|palette/.test(combined) && result.indexOf('色彩工具') < 0) result.push('色彩工具');
    else if (/font|字体|typeface|google.*font/.test(combined) && result.indexOf('字体素材') < 0) result.push('字体素材');
    else if (/shadowlibrary|安娜|档案|archive/.test(combined) && result.indexOf('图书档案') < 0) result.push('图书档案');
    else if (/designkit|美图|电商.*图|listing/.test(combined) && result.indexOf('电商工具') < 0) result.push('电商工具');
  }
  if (result.indexOf('电商') >= 0) {
    if (/temu|1688|淘宝|taobao|京东|jd|国内|天猫|微信小店|store\.weixin/.test(combined) && result.indexOf('国内电商') < 0) result.push('国内电商');
    else if (/amazon|ebay|aliexpress|shopee|lazada|跨境|独立站|shoplazza/.test(combined) && result.indexOf('跨境电商') < 0) result.push('跨境电商');
    else if (/linkfox|选品/.test(combined) && result.indexOf('选品工具') < 0) result.push('选品工具');
  }
  if (result.indexOf('工具') >= 0) {
    if (/deepl|translate|翻译|google.*翻译/.test(combined) && result.indexOf('翻译工具') < 0) result.push('翻译工具');
    else if (/drive|网盘|onedrive|dropbox|存储/.test(combined) && result.indexOf('存储网盘') < 0) result.push('存储网盘');
    else if (/快递|物流|ship/.test(combined) && result.indexOf('快递物流') < 0) result.push('快递物流');
    else if (/adobe|express|设计.*工具/.test(combined) && result.indexOf('设计工具') < 0) result.push('设计工具');
    else if (/pdf|compress|压缩/.test(combined) && result.indexOf('文件处理') < 0) result.push('文件处理');
    else if (/mail|gmail|邮箱|qq.*邮箱/.test(combined) && result.indexOf('邮箱') < 0) result.push('邮箱');
    else if (/flomo|memo|笔记|知识|karakeep|书签/.test(combined) && result.indexOf('知识管理') < 0) result.push('知识管理');
    else if (/n8n|workflow|automation|5678/.test(combined) && result.indexOf('自动化') < 0) result.push('自动化');
    else if (/api|接口/.test(combined) && result.indexOf('API') < 0) result.push('API');
    else if (/music|音频|ace.step|生成.*音乐/.test(combined) && result.indexOf('AI工具') < 0) result.push('AI工具');
  }
  if (result.indexOf('社区') >= 0) {
    if (/bilibili|抖音|tiktok|instagram|facebook|youtube|lofter|即刻|okjike|reddit|x\.com|twitter|xiaohongshu|小红书/.test(combined) && result.indexOf('社交平台') < 0) result.push('社交平台');
    else if (/v2ex|discord|stackoverflow|hacker.?news|reddit|linux\.do/.test(combined) && result.indexOf('技术社区') < 0) result.push('技术社区');
    else if (/豆瓣|知乎|今日头条|少数派|sspai|toutiao/.test(combined) && result.indexOf('内容平台') < 0) result.push('内容平台');
    else if (/kol|达人|创作者|afdian/.test(combined) && result.indexOf('创作者平台') < 0) result.push('创作者平台');
  }
  if (result.indexOf('媒体') >= 0) {
    if (/news|日报|热榜|资讯|techcrunch|readhub|newrank|新榜/.test(combined) && result.indexOf('资讯') < 0) result.push('资讯');
    else if (/创作中心|creator|创作者|头条号|百家号|视频号|喜马拉雅|bilibili.*upload|cool\.bilibili|open\.bilibili/.test(combined) && result.indexOf('创作者平台') < 0) result.push('创作者平台');
    else if (/小说|novel|文学|起点|晋江|番茄.*小说|qidian|jjwxc/.test(combined) && result.indexOf('文学平台') < 0) result.push('文学平台');
    else if (/figma|canva|strikingly|建站|网站.*建立/.test(combined) && result.indexOf('创作工具') < 0) result.push('创作工具');
    else if (/adsense|advertising|广告/.test(combined) && result.indexOf('广告平台') < 0) result.push('广告平台');
    else if (/zhihu.*write|知乎.*写|zhuanlan/.test(combined) && result.indexOf('内容平台') < 0) result.push('内容平台');
    else if (/x\.com|twitter|youtube|xiaohongshu|小红书|bilibili|哔哩/.test(combined) && result.indexOf('社交平台') < 0) result.push('社交平台');
  }
  if (result.indexOf('产品') >= 0) {
    if (/kickstarter|indiegogo|众筹|modian|摩点|gofundme/.test(combined) && result.indexOf('众筹平台') < 0) result.push('众筹平台');
    else if (/patreon|afdian|爱发电|面包多|gumroad|知识星球|zsxq/.test(combined) && result.indexOf('创作者变现') < 0) result.push('创作者变现');
    else if (/数字藏品|nft|鲸探/.test(combined) && result.indexOf('数字藏品') < 0) result.push('数字藏品');
  }
  if (result.indexOf('参考') >= 0) {
    if (/arxiv|paper|论文|万方|huggingface.*paper|research/.test(combined) && result.indexOf('学术论文') < 0) result.push('学术论文');
    else if (/book|图书|gutenberg|古腾堡|电子书|yabook/.test(combined) && result.indexOf('图书档案') < 0) result.push('图书档案');
    else if (/austinkleon|创意行为/.test(combined) && result.indexOf('设计参考') < 0) result.push('设计参考');
  }
  if (result.indexOf('开发') >= 0) {
    if (/github|gitlab|git\b/.test(combined) && result.indexOf('代码托管') < 0) result.push('代码托管');
    else if (/stackoverflow|csdn|segmentfault/.test(combined) && result.indexOf('技术问答') < 0) result.push('技术问答');
    else if (/npm|packagist|pypi/.test(combined) && result.indexOf('包管理') < 0) result.push('包管理');
    else if (/open\.douyin|open\.feishu|开放平台|developer/.test(combined) && result.indexOf('开发平台') < 0) result.push('开发平台');
  }
  if (result.indexOf('前端') >= 0) {
    if (/mdn|docs|文档|reference/.test(combined) && result.indexOf('文档参考') < 0) result.push('文档参考');
    else if (/vercel|deploy|部署/.test(combined) && result.indexOf('部署平台') < 0) result.push('部署平台');
    else if (/blackcamellia|localhost|个人|portfolio/.test(combined) && result.indexOf('个人站点') < 0) result.push('个人站点');
    else if (/music|ai.*music|音频.*生成/.test(combined) && result.indexOf('AI工具') < 0) result.push('AI工具');
    else if (/21st|component|ui.*kit|组件/.test(combined) && result.indexOf('UI组件') < 0) result.push('UI组件');
  }
  if (result.indexOf('学习') >= 0) {
    if (/course|课程|tutorial|教程/.test(combined) && result.indexOf('教程课程') < 0) result.push('教程课程');
    else if (/docs|文档|手册|guide|context7/.test(combined) && result.indexOf('文档手册') < 0) result.push('文档手册');
    else if (/opencli|cli/.test(combined) && result.indexOf('文档手册') < 0) result.push('文档手册');
  }
  if (result.indexOf('搜索') >= 0) {
    if (/google|bing|baidu|百度|perplexity|搜索/.test(combined) && result.indexOf('通用搜索') < 0) result.push('通用搜索');
  }
  if (result.indexOf('写作') >= 0) {
    if (/paulgraham|博客|blog/.test(combined) && result.indexOf('博客') < 0) result.push('博客');
    else if (/女娲|蒸馏|目录|思维顾问/.test(combined) && result.indexOf('文档手册') < 0) result.push('文档手册');
  }
  // Deduplicate
  var seen = new Set();
  return result.filter(function(d) { if (seen.has(d)) return false; seen.add(d); return true; });
}

function appFactory() {
  const app = express();
  app.use(express.json());

  // POST /sources — add a new source
  app.post('/sources', function(req, res) {
    const VALID_TIERS = ['S', 'A', 'block'];
    const VALID_TYPES = ['权威源', '聚合源', '平台', '社区', 'AI原生'];

    const b = req.body;
    var errors = [];

    if (!b.title || typeof b.title !== 'string') errors.push('title is required');
    if (!b.why || typeof b.why !== 'string' || b.why.trim().length < 6) errors.push('why is required (min 6 chars)');
    if (!VALID_TIERS.includes(b.tier)) errors.push('tier must be S, A, or block');
    if (!Array.isArray(b.domains) || b.domains.length === 0) errors.push('domains must be a non-empty array');
    if (!VALID_TYPES.includes(b.source_type)) errors.push('source_type invalid: must be 权威源|聚合源|平台|社区|AI原生');
    if (!Array.isArray(b.tags) || b.tags.length === 0) errors.push('tags must be a non-empty array');

    // URL validation — enforce https://, reject file:// and bare domains
    if (!b.url || typeof b.url !== 'string') {
      errors.push('url is required');
    } else if (/^file:\/\//i.test(b.url)) {
      errors.push('url: file:// not accepted — local files should not be added as web sources');
    } else if (!/^https?:\/\//.test(b.url.trim())) {
      errors.push('url: must start with https:// (bare domains like "example.com" are not accepted — prepend https://)');
    }

    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors: errors });
    }

    // Duplicate URL check — prevent two files pointing to same URL
    var normalizedNew = b.url.trim().replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    var dup = scanSources().find(function(s) {
      if (!s.url) return false;
      var existing = s.url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
      return existing === normalizedNew;
    });
    if (dup) {
      return res.status(409).json({
        ok: false,
        errors: ['URL already exists: ' + dup.file],
        existing: { file: dup.file, title: dup.title, url: dup.url }
      });
    }

    // Auto-assign secondary domains
    b.domains = autoAssignSecondaries(b.domains, b.url, b.title);

    // Derive filename from URL
    var host = b.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    var fname = host.replace(/[^a-zA-Z0-9.-]/g, '-').replace(/\./g, '-') + '.md';
    fname = fname.replace(/-+\.md$/, '.md');

    // Check if target file already exists (different URL, same derived filename)
    if (fs.existsSync(path.join(SOURCES_DIR, fname))) {
      return res.status(409).json({
        ok: false,
        errors: ['Target file already exists: ' + fname + ' — add a distinguishing prefix to the URL or rename manually'],
      });
    }

    var today = new Date().toISOString().slice(0, 10);
    // Strip tags that duplicate domain names
    var cleanTags = b.tags.filter(function(t) { return !b.domains.includes(t); });
    if (cleanTags.length === 0) cleanTags = b.tags; // fallback: keep at least one tag
    var frontmatter = [
      '---',
      'title: "' + b.title.replace(/"/g, '\\"') + '"',
      'url: ' + b.url.trim(),
      'tier: ' + b.tier,
      'domains: [' + b.domains.map(function(d) { return '"' + d.replace(/"/g, '\\"') + '"'; }).join(', ') + ']',
      'source_type: ' + b.source_type,
      'tags: [' + cleanTags.map(function(t) { return '"' + t.replace(/"/g, '\\"') + '"'; }).join(', ') + ']',
      'why: "' + b.why.replace(/"/g, '\\"') + '"',
      'added: ' + today,
      'type: source'
    ];
    if (b.search) frontmatter.push('search: "' + b.search.replace(/"/g, '\\"') + '"');
    frontmatter.push('---');
    frontmatter.push('');
    frontmatter.push('# ' + b.title);
    frontmatter.push('');
    if (b.note) frontmatter.push(b.note);

    var filePath = path.join(SOURCES_DIR, fname);
    try {
      fs.writeFileSync(filePath, frontmatter.join('\n'), 'utf8');
      res.json({ ok: true, file: fname, path: filePath });
    } catch (e) {
      res.status(500).json({ ok: false, errors: [e.message] });
    }
  });

  // POST /sources/touch — update last_used timestamp
  app.post('/sources/touch', function(req, res) {
    var fname = req.body.file;
    if (!fname) return res.status(400).json({ ok: false, errors: ['file is required'] });
    var filePath = path.join(SOURCES_DIR, fname);
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, errors: ['file not found: ' + fname] });
    var raw = fs.readFileSync(filePath, 'utf8');
    var today = new Date().toISOString().slice(0, 10);
    var updated;
    if (/^---\n[\s\S]*?---\n/.test(raw)) {
      if (/last_used:/.test(raw)) {
        updated = raw.replace(/(last_used:\s*).*/, '$1' + today);
      } else if (/^added:/.test(raw)) {
        updated = raw.replace(/^(added:.*\n)/m, '$1last_used: ' + today + '\n');
      } else {
        updated = raw.replace(/^(url:.*\n)/m, '$1last_used: ' + today + '\n');
      }
    } else {
      return res.status(400).json({ ok: false, errors: ['no frontmatter found'] });
    }
    fs.writeFileSync(filePath, updated, 'utf8');
    res.json({ ok: true, file: fname, last_used: today });
  });

  // GET /sources/stale — sources sorted by staleness (candidates for cleanup)
  app.get('/sources/stale', function(req, res) {
    var days = parseInt(req.query.days, 10) || 90;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    var cutoffStr = cutoff.toISOString().slice(0, 10);
    var sources = scanSources();
    var stale = sources.filter(function(s) {
      if (s.tier === 'block') return false;
      if (s.last_used && s.last_used >= cutoffStr) return false;
      if (s.added && s.added >= cutoffStr) return false;
      return true;
    });
    stale.sort(function(a, b) {
      var aDate = a.last_used || a.added || '0000-00-00';
      var bDate = b.last_used || b.added || '0000-00-00';
      return aDate.localeCompare(bDate); // oldest first
    });
    res.json({ ok: true, count: stale.length, cutoff: cutoffStr, sources: stale.map(function(s) {
      return { file: s.file, title: s.title, url: s.url, tier: s.tier, added: s.added, last_used: s.last_used || null, domains: s.domains };
    })});
  });

  // GET /sources/check — health check: verify URLs return 2xx
  app.get('/sources/check', function(req, res) {
    var sources = scanSources();
    var results = sources.filter(function(s) { return s.url && /^https?:\/\//.test(s.url); }).map(function(s) {
      return { file: s.file, title: s.title, url: s.url, tier: s.tier };
    });
    res.json({ ok: true, count: results.length, sources: results, hint: 'Use POST /sources/check to run actual HTTP checks (read-only GET only lists candidates)' });
  });

  app.get('/', function(req, res) {
    let sources = scanSources();
    sources.sort(function(a, b) {
      var tierDiff = (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9);
      if (tierDiff !== 0) return tierDiff;
      // Within same tier: last_used desc, then added desc — stale sinks to bottom
      var aLU = a.last_used || '0000-00-00';
      var bLU = b.last_used || '0000-00-00';
      if (aLU !== bLU) return bLU.localeCompare(aLU);
      var aAD = a.added || '0000-00-00';
      var bAD = b.added || '0000-00-00';
      return bAD.localeCompare(aAD);
    });

    // Normalize domains: support both legacy `domain` string and new `domains` array
    sources.forEach(function(s) {
      if (!s.domains && s.domain) { s.domains = Array.isArray(s.domain) ? s.domain : [s.domain]; }
      if (!s.domains) s.domains = [];
    });

    // Build domain chips — dynamic from actual data
    const domainCounts = {};
    const DOMAIN_ORDER = ['AI', '设计', '电商', '工具', '开发', '前端', '产品', '写作', '学习', '社区', '媒体', '参考', '搜索'];
    const topDomains = new Set(DOMAIN_ORDER);
    sources.forEach(function(s) {
      (s.domains || []).forEach(function(d) { domainCounts[d] = (domainCounts[d] || 0) + 1; });
    });
    // Derive parent-child counts: sub-domain → { parent: count }
    const subParents = {};       // { parent1: true, parent2: true } — used for visibility
    const subParentCounts = {};  // { parent1: n1, parent2: n2 } — used for per-primary chip count
    sources.forEach(function(s) {
      const doms = s.domains || [];
      doms.forEach(function(sub) {
        if (!topDomains.has(sub)) {
          doms.forEach(function(top) {
            if (topDomains.has(top) && top !== sub) {
              if (!subParents[sub]) { subParents[sub] = {}; subParentCounts[sub] = {}; }
              subParents[sub][top] = true;
              subParentCounts[sub][top] = (subParentCounts[sub][top] || 0) + 1;
            }
          });
        }
      });
    });

    const domainTips = {
      'AI': '人工智能 · LLM、Agent、图像/视频/语音/3D 生成',
      '设计': '视觉设计 · 字体、UI/UX、室内设计、品牌',
      '电商': '电子商务 · 跨境电商、独立站、平台运营',
      '工具': '效率工具 · 开发工具、自动化、数据分析',
      '开发': '软件开发 · 后端、架构、基础设施',
      '前端': '前端开发 · HTML/CSS/JS、框架、工程化',
      '产品': '产品管理 · 需求、增长、用户体验',
      '写作': '内容写作 · 技术写作、文案、出版',
      '学习': '学习资源 · 课程、教程、文档',
      '社区': '技术社区 · 论坛、问答、开源社区',
      '媒体': '科技媒体 · 新闻、评论、行业分析',
      '参考': '参考资源 · 文档、规范、速查表',
      '搜索': '搜索引擎 · 通用搜索、垂直搜索',
      '商业': '商业管理 · 创业、营销、财务',
    };
    // ─── Domain icons (inline SVG, 14×14, stroke=currentColor) ───
    const DOMAIN_ICONS = {
      'AI': '<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,0.5 13.5,7 7,13.5 0.5,7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      '设计': '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      '电商': '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" rx="1"/><line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1"/></svg>',
      '工具': '<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,0.5 13,5 13,13 1,13 1,5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="8" r="1.8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
      '开发': '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M5,3 L1.5,7 L5,11 M9,3 L12.5,7 L9,11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      '前端': '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="2" width="13" height="10" fill="none" stroke="currentColor" stroke-width="1.5" rx="1"/><line x1="0.5" y1="5.5" x2="13.5" y2="5.5" stroke="currentColor" stroke-width="1"/><circle cx="7" cy="2" r="1.5" fill="currentColor"/></svg>',
      '产品': '<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,0.5 12.5,4 12.5,10 7,13.5 1.5,10 1.5,4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
      '写作': '<svg width="14" height="14" viewBox="0 0 14 14"><line x1="1.5" y1="3" x2="12.5" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1.5" y1="7" x2="12.5" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1.5" y1="11" x2="8.5" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      '学习': '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="7" r="2" fill="currentColor"/></svg>',
      '社区': '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="4" cy="4.5" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="10" cy="4.5" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="2" y1="11" x2="7" y2="7.5" stroke="currentColor" stroke-width="1.2"/><line x1="12" y1="11" x2="7" y2="7.5" stroke="currentColor" stroke-width="1.2"/><line x1="2" y1="13" x2="12" y2="13" stroke="currentColor" stroke-width="1.2"/></svg>',
      '媒体': '<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="3,1.5 3,12.5 11.5,7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
      '参考': '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="0.5" width="10" height="13" fill="none" stroke="currentColor" stroke-width="1.5" rx="1"/><line x1="4.5" y1="4" x2="10" y2="4" stroke="currentColor" stroke-width="1"/><line x1="4.5" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1"/></svg>',
      '搜索': '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="5.5" cy="5.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="9" y1="9" x2="13" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    };
    function domainIcon(d) {
      if (DOMAIN_ICONS[d]) return '<span class="domain-icon">' + DOMAIN_ICONS[d] + '</span>';
      // Secondary: inherit icon from first parent primary
      var parents = subParents[d];
      if (parents) {
        for (var p of DOMAIN_ORDER) { if (parents[p]) return '<span class="domain-icon">' + DOMAIN_ICONS[p] + '</span>'; }
      }
      return '';
    }

    let topChipsHTML = '<span class="filter-row-label">一级</span>\n<span class="chip active" data-domain="all" onclick="setDomain(\'all\')">全部</span>\n';
    DOMAIN_ORDER.forEach(function(d) {
      const n = domainCounts[d] || 0;
      const dim = n === 0 ? ' dim' : '';
      const tip = domainTips[d] || '';
      const icon = DOMAIN_ICONS[d] ? '<span class="domain-icon">' + DOMAIN_ICONS[d] + '</span>' : '';
      topChipsHTML += '<span class="chip' + dim + '" data-domain="' + esc(d) + '" onclick="setDomain(\'' + esc(d) + '\')"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + icon + esc(d) + ' <strong>' + n + '</strong></span>\n';
    });

    const subList = Object.keys(domainCounts)
      .filter(function(d) { return !topDomains.has(d); })
      .sort(function(a, b) { return (domainCounts[b]||0) - (domainCounts[a]||0); });
    let subChipsHTML = '<span class="filter-row-label">二级</span>\n';
    if (subList.length === 0) {
      subChipsHTML += '<span class="chip dim">—</span>';
    } else {
      subList.forEach(function(d) {
        const n = domainCounts[d] || 0;
        const parents = subParents[d] ? Object.keys(subParents[d]).join(' ') : '';
        const parentCountsJson = subParentCounts[d] ? JSON.stringify(subParentCounts[d]).replace(/"/g, '&quot;') : '{}';
        const icon = domainIcon(d);
        subChipsHTML += '<span class="chip sub-chip" data-domain="' + esc(d) + '" data-parents="' + esc(parents) + '" data-global-count="' + n + '" data-parent-counts="' + parentCountsJson + '" onclick="setDomain(\'' + esc(d) + '\')">' + icon + esc(d) + ' <strong>' + n + '</strong></span>\n';
      });
    }

    // Build tier chips
    const tierCounts = {};
    sources.forEach(function(s) { if (s.tier) tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1; });
    const tierLabels = { S: 'S 固定信源', A: 'A 补充信源', block: '✕ 黑名单' };
    const tierTips = {
      S: '无论如何都信任的权威来源。跟使用频率无关——哪怕一个月没打开，依然相信。一手/权威/不可替代',
      A: '不够权威但可补充查阅。有可替代方案，交叉验证使用',
      block: '绝对不用。反爬严重/注水严重/低质/抄袭/SEO垃圾/内容农场。所有搜索自动跳过',
    };
    let tierChipsHTML = '<span class="filter-row-label">档位</span>\n<span class="chip active" data-tier="all" onclick="setTier(\'all\')">全部</span>\n';
    ['S', 'A', 'block'].forEach(function(t) {
      const n = tierCounts[t] || 0;
      const tip = tierTips[t] || '';
      tierChipsHTML += '<span class="chip" data-tier="' + t + '" onclick="setTier(\'' + t + '\')"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + tierLabels[t] + ' <strong>' + n + '</strong></span>\n';
    });
    tierChipsHTML += '<span class="count-badge" id="countDisplay"></span>';

    // Build type chips
    const types = {};
    sources.forEach(function(s) { if (s.source_type) types[s.source_type] = (types[s.source_type] || 0) + 1; });
    const typeTips = {
      '权威源': '一手原创内容 · 领域权威来源 · 搜索: site:domain {query}',
      '聚合源': '聚合多方内容 · 需追溯原始来源 · 搜索: 站内搜→原链',
      '平台': '内容托管平台 · 来源定位在账号层级 · 搜索: @账号限定',
      '社区': '用户生成内容社区 · 需自行评估置信度 · 搜索: 搜+置信度',
      'AI原生': 'AI 驱动的搜索/生成工具 · 抓取: API/结构化',
    };
    let typeChips = '<span class="chip active" data-type="all" onclick="setType(\'all\')">全部</span>\n';
    const typeOrder = ['权威源', '聚合源', '平台', '社区', 'AI原生'];
    typeOrder.forEach(function(t) {
      const n = types[t] || 0;
      const tip = typeTips[t] || '';
      if (n > 0) typeChips += '<span class="chip" data-type="' + esc(t) + '" onclick="setType(\'' + esc(t) + '\')"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + esc(t) + ' <strong>' + n + '</strong></span>\n';
    });

    // Build rows
    function strategy(type) {
      const map = { '权威源': 'site: 直接定位', '聚合源': '站内搜→原链', '平台': '@账号限定', '社区': '搜+置信度', 'AI原生': 'API/结构化抓' };
      return map[type] || '';
    }
    function daysAgo(dateStr) {
      if (!dateStr) return Infinity;
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return Infinity;
      return Math.floor((new Date() - d) / 86400000);
    }
    function staleClass(s) {
      var d = daysAgo(s.last_used || s.added);
      if (d > 90 && !s.last_used) return ' stale';
      return '';
    }
    function staleLabel(s) {
      var d = daysAgo(s.last_used || s.added);
      if (!s.last_used && s.added && d > 90) {
        return '<span class="stale-badge" title="' + d + '天未使用，候选清理">' + d + '天</span>';
      }
      if (s.last_used && d > 30) {
        return '<span class="stale-badge warm" title="上次使用：' + s.last_used + '">' + d + '天</span>';
      }
      return '';
    }
    function favicon(url) {
      if (!url) return '';
      const domain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
      return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=32';
    }
    function displayUrl(url) {
      if (!url) return '';
      return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    }
    function hrefUrl(url) {
      if (!url) return '#';
      if (/^https?:\/\//.test(url)) return url;
      return 'https://' + url;
    }
    let rows = sources.length === 0
      ? '<div class="empty">暂无信息源 · 在 ' + SOURCES_DIR + ' 下创建 .md 文件</div>'
      : sources.map(function(s) {
        const tags = (Array.isArray(s.tags) ? s.tags : []).map(function(t) {
          return '<span class="tag clickable" onclick="event.stopPropagation();setSearch(\'' + esc(t) + '\')">' + esc(t) + '</span>';
        }).join('');
        const domainsArr = s.domains || [];
        const domainBadges = domainsArr.length === 0
          ? '<span class="cell-chip muted">—</span>'
          : domainsArr.map(function(d) { return '<span class="cell-chip clickable domain-badge" onclick="event.stopPropagation();setDomain(\'' + esc(d) + '\')" title="按领域筛选：' + esc(d) + '">' + esc(d) + '</span>'; }).join('');
        const fv = favicon(s.url);
        const stype = s.source_type || '';
        return '<div class="row' + staleClass(s) + '" data-tier="' + esc(s.tier||'') + '" data-domain="' + esc(domainsArr.join(' ')) + '" data-type="' + esc(stype) + '" data-text="' + esc((s.title||'') + ' ' + (s.url||'') + ' ' + (s.tags||[]).join(' ') + ' ' + domainsArr.join(' ')) + '">' +
          '<div class="tier-badge ' + badgeClass(s.tier) + '">' + (s.tier === 'block' ? '✕' : esc(s.tier||'?')) + '</div>' +
          '<div class="domain-cell">' + domainBadges + '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;"><img class="favicon" src="' + fv + '" width="20" height="20" loading="lazy" onerror="this.style.display=\'none\'"><div><div class="src-name">' + esc(s.title||s.file||'') + staleLabel(s) + '</div><a class="src-url" href="' + esc(hrefUrl(s.url||'')) + '" target="_blank" rel="noopener">' + esc(displayUrl(s.url||'')) + '</a></div></div>' +
          '<div><span class="cell-chip clickable src-type" onclick="event.stopPropagation();setType(\'' + esc(stype) + '\')" title="按类型筛选：' + esc(stype) + '">' + esc(stype) + '</span></div>' +
          '<div><span class="cell-chip muted">' + strategy(s.source_type) + '</span></div>' +
          '<div class="tag-cell">' + tags + '</div>' +
        '</div>';
      }).join('');

    let html = HTML
      .replace(/SOURCES_PLACEHOLDER_COUNT/g, String(sources.length))
      .replace('SOURCES_PLACEHOLDER_ROWS', rows)
      .replace('SOURCES_PLACEHOLDER_DIR', SOURCES_DIR);
    // inject domain, tier & type chips
    html = html.replace('TIER_CHIPS_ROW', tierChipsHTML);
    html = html.replace('DOMAIN_TOP_ROW', topChipsHTML);
    html = html.replace('DOMAIN_SUB_ROW', subChipsHTML);
    html = html.replace('<span class="chip active" data-type="all" onclick="setType(\'all\')">全部</span>',
      typeChips);

    res.set('Cache-Control', 'no-cache');
    res.send(html);
  });

  // GET /health — data integrity self-check
  app.get('/health', function(req, res) {
    const sources = scanSources();
    const VALID_TIERS = ['S', 'A', 'block'];
    const VALID_TYPES = ['权威源', '聚合源', '平台', '社区', 'AI原生'];

    const checks = [];
    const issues = [];

    // 1. Total count
    checks.push({ rule: 'total_sources', ok: true, detail: sources.length + ' sources' });

    // 2. Tier distribution
    const tierDist = {};
    sources.forEach(function(s) { tierDist[s.tier||'(missing)'] = (tierDist[s.tier||'(missing)'] || 0) + 1; });
    checks.push({ rule: 'tier_dist', ok: true, detail: tierDist });

    // 3. Invalid tiers
    const invalidTiers = sources.filter(function(s) { return s.tier && !VALID_TIERS.includes(s.tier); });
    if (invalidTiers.length > 0) {
      issues.push({ rule: 'invalid_tiers', count: invalidTiers.length, files: invalidTiers.map(function(s) { return s.file + ' → ' + s.tier; }) });
    }

    // 4. Type distribution
    const typeDist = {};
    sources.forEach(function(s) { typeDist[s.source_type||'(missing)'] = (typeDist[s.source_type||'(missing)'] || 0) + 1; });
    checks.push({ rule: 'type_dist', ok: true, detail: typeDist });

    // 5. Invalid types
    const invalidTypes = sources.filter(function(s) { return s.source_type && !VALID_TYPES.includes(s.source_type); });
    if (invalidTypes.length > 0) {
      issues.push({ rule: 'invalid_types', count: invalidTypes.length, files: invalidTypes.map(function(s) { return s.file + ' → ' + s.source_type; }) });
    }

    // 6. Missing URLs
    const missingUrl = sources.filter(function(s) { return !s.url; });
    if (missingUrl.length > 0) {
      issues.push({ rule: 'missing_url', count: missingUrl.length, files: missingUrl.map(function(s) { return s.file; }) });
    }

    // 7. Missing tier
    const missingTier = sources.filter(function(s) { return !s.tier; });
    if (missingTier.length > 0) {
      issues.push({ rule: 'missing_tier', count: missingTier.length, files: missingTier.map(function(s) { return s.file; }) });
    }

    // 8. Missing source_type
    const missingType = sources.filter(function(s) { return !s.source_type; });
    if (missingType.length > 0) {
      issues.push({ rule: 'missing_type', count: missingType.length, files: missingType.map(function(s) { return s.file; }) });
    }

    // 9. Duplicate URLs
    const urlMap = {};
    sources.forEach(function(s) {
      if (!s.url) return;
      var u = s.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (!urlMap[u]) urlMap[u] = [];
      urlMap[u].push(s.file);
    });
    const dupUrls = Object.entries(urlMap).filter(function(e) { return e[1].length > 1; });
    if (dupUrls.length > 0) {
      issues.push({ rule: 'duplicate_urls', count: dupUrls.length, detail: dupUrls.map(function(e) { return e[0] + ' → ' + e[1].join(', '); }) });
    }

    // 10. Missing domains
    const missingDomains = sources.filter(function(s) { return !s.domains || s.domains.length === 0; });
    if (missingDomains.length > 0) {
      issues.push({ rule: 'empty_domains', count: missingDomains.length, files: missingDomains.map(function(s) { return s.file; }) });
    }

    // 11. Cross-check: tier vs type intersection table
    const intersection = {};
    sources.forEach(function(s) {
      var t = s.tier || '(missing)';
      var tp = s.source_type || '(missing)';
      if (!intersection[t]) intersection[t] = {};
      intersection[t][tp] = (intersection[t][tp] || 0) + 1;
    });
    checks.push({ rule: 'tier_type_intersection', ok: true, detail: intersection });

    // Split issues: gate_breaks (data integrity), warnings (missing metadata)
    var gateBreakRules = { duplicate_urls:1, missing_url:1, invalid_tiers:1, invalid_types:1 };
    var gate_breaks = [], warnings = [];
    issues.forEach(function(iss) {
      if (gateBreakRules[iss.rule]) gate_breaks.push(iss);
      else warnings.push(iss);
    });
    var ok = gate_breaks.length === 0;
    res.json({
      ok: ok,
      gate_ok: gate_breaks.length === 0,
      gate_breaks: gate_breaks,
      warnings: warnings,
      timestamp: new Date().toISOString(),
      total: sources.length,
      checks: checks,
      summary: ok ? (warnings.length === 0 ? 'All ' + checks.length + ' checks passed' : checks.length + ' checks, ' + warnings.length + ' warnings') : gate_breaks.length + ' gate break(s)',
    });
  });

  return app;
}

if (require.main === module) {
  const app = appFactory();
  app.listen(PORT, function() {
    console.log('\n📡 Source Rack · http://localhost:' + PORT);
    console.log('📂 Scanning: ' + SOURCES_DIR);
    console.log('📄 ' + scanSources().length + ' sources found\n');
  });
}

module.exports = { appFactory, scanSources };
