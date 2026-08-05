// Source Rack — 信息源管理面板
// Scans wiki/entities/sources/*.md → renders HTML list
const express = require('express');
const fs = require('fs');
const path = require('path');
const { PRIMARY_ORDER, PRIMARY_ICONS, PRIMARY_TIPS, normalizeDomains, getValidSecondaries, isValidPrimary } = require('./domain-registry');

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
    // Extract body description (after frontmatter, strip markdown heading)
    const body = raw.replace(/^---\n[\s\S]*?---\n/, '').trim();
    const desc = body.replace(/^#\s+.*(\n|$)/, '').trim();
    var src = norm({ file: f, desc: desc || '', ...fm });
    // Algorithm-driven tier: override takes precedence, else compute from usage
    src._stored_tier = src.tier; // preserve what's on disk
    src.tier = computeTier(src);
    // Normalize domains to new 7-primary classification
    var nd = normalizeDomains(src.domains || [], src.title, src.url);
    src._primary = nd.primary;
    src._secondary = nd.secondary;
    src._crossTags = nd.crossTags;
    return src;
  });
}

const TIER_ORDER = { S: 0, A: 1, X: 2 };

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function badgeClass(tier) {
  const map = { S: 's', A: 'a', X: 'x' };
  return 'tier-' + (map[tier] || 'c');
}

// Compute effective tier from usage data.
// S: ≥3 clicks in the last 30 days (rate-based — decays naturally if unused)
// A: default for all non-S, non-X sources
// X: human-only — requires tier_override: X
function computeTier(s) {
  if (s.tier_override) return s.tier_override;
  var recent = countRecentClicks(s);
  if (recent >= 10) return 'S';
  return 'A';
}

// Count click dates within the last 30 days
function countRecentClicks(s) {
  if (!s.click_dates || !Array.isArray(s.click_dates)) return 0;
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  var cutoffStr = cutoff.toISOString().slice(0, 10);
  var count = 0;
  for (var i = 0; i < s.click_dates.length; i++) {
    if (s.click_dates[i] >= cutoffStr) count++;
  }
  return count;
}

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>信息源管理 — Source Rack</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='4' y='18' width='5' height='10' rx='1' fill='%23002FA7'/%3E%3Crect x='13.5' y='10' width='5' height='18' rx='1' fill='%23002FA7'/%3E%3Crect x='23' y='4' width='5' height='24' rx='1' fill='%23002FA7'/%3E%3Ccircle cx='6.5' cy='6' r='2.5' fill='%23002FA7' opacity='.35'/%3E%3Ccircle cx='16' cy='6' r='2.5' fill='%23002FA7' opacity='.55'/%3E%3Ccircle cx='25.5' cy='6' r='2.5' fill='%23002FA7' opacity='.75'/%3E%3C/svg%3E">
<style>
  :root {
    /* Warm ivory + clay — aligned with minds.evopearl.com */
    --paper: #faf9f5;
    --ink: #141413;
    --ink-rgb: 20,20,19;
    --grey-1: #f5f4ed;
    --grey-2: #d4d4d2;
    --grey-3: #737373;
    --accent: #d97757;
    --accent-on: #ffffff;
    --malachite: #509070;
    --text-primary: #141413;
    --text-secondary: #525252;
    --text-helper: #737373;
    --text-placeholder: #a3a3a3;
    --border-subtle: #e0ddd5;
    /* Carbon spacing */
    --sp-3: 8px; --sp-4: 12px; --sp-5: 16px; --sp-6: 24px; --sp-7: 32px; --sp-8: 40px;
    --sans: "DM Sans", "Inter", "Helvetica Neue", "Helvetica", "Arial", system-ui, -apple-system, sans-serif;
    --sans-zh: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
    --serif: "Noto Serif SC", "Source Serif 4", Georgia, serif;
    --mono: "IBM Plex Mono", "JetBrains Mono", "SF Mono", "Cascadia Code", "Consolas", ui-monospace, monospace;
    --radius-sm: 6px; --radius-md: 8px; --radius-pill: 20px;
    --shadow-card: 0 1px 1px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.03);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--sans), var(--sans-zh);
    background: var(--paper); color: var(--ink); line-height: 1.5; font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Header ── */
  .topbar {
    padding: var(--sp-7) 24px var(--sp-6);
    display: flex; align-items: flex-end; justify-content: space-between;
    border-bottom: 2px solid var(--ink);
  }
  .topbar .head-group { display: flex; align-items: center; gap: var(--sp-4); }
  .topbar .logo { flex-shrink: 0; }
  .topbar h1 {
    font-family: var(--serif), var(--sans-zh);
    font-size: 28px; font-weight: 700; letter-spacing: -0.02em;
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
  /* ── Container ── */
  .container { max-width: 1600px; margin: 0 auto; padding: var(--sp-6) 24px; }

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
    font-family: var(--mono); font-size: 10px; font-weight: 500;
    color: rgba(var(--ink-rgb), 0.35); text-transform: uppercase;
    letter-spacing: 0.08em;
    min-width: 32px; flex-shrink: 0;
  }
  .chip {
    padding: 7px 18px; font-size: 13px; font-weight: 500;
    background: transparent; border: 1px solid rgba(var(--ink-rgb), 0.12);
    cursor: pointer; border-radius: var(--radius-pill);
    transition: all 0.18s; user-select: none; white-space: nowrap;
    color: rgba(var(--ink-rgb), 0.6); display: inline-flex; align-items: center; gap: 5px;
    font-family: var(--mono); letter-spacing: 0.04em;
  }
  .domain-icon { display: inline-flex; align-items: center; flex-shrink: 0; color: var(--accent); }
  .chip.active .domain-icon { color: var(--accent-on); }
  .chip.parent-active .domain-icon { color: var(--accent); }
  .domain-icon svg { display: block; }
  .chip:hover { background: var(--grey-1); color: var(--ink); border-color: rgba(var(--ink-rgb), 0.25); }
  .chip.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .chip.parent-active { border-color: var(--accent); color: var(--accent); background: rgba(217,119,87,0.06); }
  .chip.dim { opacity: 0.25; pointer-events: none; }
  .chip strong { font-weight: 600; }
  /* tooltip — positioned above chip, out of flow */
  .chip[data-tip] { position: relative; }
  .chip[data-tip]:hover::after {
    content: attr(data-tip);
    position: absolute; bottom: calc(100% + 6px); left: 50%;
    transform: translateX(-50%);
    background: var(--grey-1); color: var(--ink);
    padding: 6px 12px; font-size: 12px; line-height: 1.5;
    white-space: nowrap; z-index: 999; pointer-events: none;
    border: 1px solid rgba(var(--ink-rgb), 0.08);
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
    display: grid; grid-template-columns: 52px 1fr 150px 100px 140px 220px;
    padding: 11px var(--sp-5); border-bottom: 1px solid rgba(var(--ink-rgb), 0.9);
    background: var(--ink); font-size: 11px; font-weight: 500;
    color: rgba(255,255,255,0.5); letter-spacing: 0.05em;
    align-items: center; gap: var(--sp-4);
    font-family: var(--mono); text-transform: uppercase;
  }
  .row {
    display: grid; grid-template-columns: 52px 1fr 150px 100px 140px 220px;
    padding: 13px var(--sp-5); border-bottom: 1px solid var(--border-subtle);
    align-items: center; gap: var(--sp-4); transition: background 0.1s;
  }
  .row:last-child { border-bottom: none; }
  .row:hover { background: rgba(217,119,87,0.04); }
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
    width: 30px; height: 30px; font-weight: 600; font-size: 12px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    font-family: var(--mono); border-radius: var(--radius-sm);
  }
  .tier-s { color: var(--accent); border: 1.5px solid var(--accent); background: rgba(217,119,87,0.06); }
  .tier-a { color: rgba(var(--ink-rgb), 0.35); border: 1px solid rgba(var(--ink-rgb), 0.12); }
  .tier-x { color: #c00; border: 1.5px solid #c00; background: rgba(204,0,0,0.04); }

  /* ── Cell chips: domain / type / strategy / tag — all chip-style ── */
  .cell-chip {
    display: inline-block; padding: 3px 10px; font-size: 11px; font-weight: 500;
    border: 1px solid rgba(var(--ink-rgb), 0.08); color: rgba(var(--ink-rgb), 0.5);
    white-space: nowrap; cursor: default; border-radius: var(--radius-sm);
    font-family: var(--mono); letter-spacing: 0.03em;
  }
  .cell-chip.clickable { cursor: pointer; }
  .cell-chip.clickable:hover { border-color: rgba(var(--ink-rgb), 0.25); color: var(--ink); background: var(--grey-1); }
  .cell-chip.muted { color: var(--text-helper); }

  .domain-badge { margin-right: 4px; margin-bottom: 3px; }
  .domain-cell { display: flex; flex-wrap: nowrap; gap: 0; overflow: hidden; }
  .src-type { margin-right: 4px; }
  .tag {
    display: inline-block; padding: 3px 10px; font-size: 11px; font-weight: 500;
    border: 1px solid rgba(var(--ink-rgb), 0.08); color: rgba(var(--ink-rgb), 0.5);
    white-space: nowrap; margin-right: 4px; margin-bottom: 3px;
    border-radius: var(--radius-sm); font-family: var(--mono); letter-spacing: 0.03em;
  }
  .tag.clickable { cursor: pointer; }
  .tag.clickable:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .tag-cell { display: flex; flex-wrap: nowrap; gap: 3px; overflow: hidden; }

  /* ── Source info ── */
  .src-name { font-weight: 600; font-size: 14px; color: var(--ink); letter-spacing: -0.01em; }
  .src-url, .src-url:visited { font-size: 12px; color: var(--accent); margin-top: 1px; font-family: var(--mono); text-decoration: none; }
  .src-url:hover { color: var(--ink); text-decoration: underline; }
  .src-desc { font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.5; max-width: 480px; }
  .click-badge {
    font-size: 11px; font-weight: 600;
    padding: 2px 8px; margin-left: 6px;
    display: inline-block; vertical-align: middle;
    color: #9ca3af; border: 1px solid #e5e7eb;
  }
  .click-warm { color: #d97706; border-color: #fcd34d; background: rgba(245,158,11,0.08); }
  .click-hot  { color: #fff; background: #ef4444; border-color: #ef4444; }
  a.heat-toggle {
    font-family: var(--serif); font-size: 13px; font-weight: 600;
    color: var(--malachite); text-decoration: none;
    cursor: pointer; padding: 4px 14px;
    border: 1px solid rgba(80,144,112,0.35);
    border-radius: var(--radius-pill);
    user-select: none; display: inline-block;
    transition: all 0.18s; letter-spacing: 0.03em;
  }
  a.heat-toggle:hover { background: rgba(80,144,112,0.08); border-color: var(--malachite); }
  a.heat-toggle.on { color: var(--accent); border-color: rgba(217,119,87,0.35); }
  a.heat-toggle.on:hover { background: rgba(217,119,87,0.08); border-color: var(--accent); }
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
    <div class="filter-row domain-top-row">
      DOMAIN_TOP_ROW
    </div>
    <div class="filter-row" id="subDomainRow" style="display:none;">
      DOMAIN_SUB_ROW
    </div>
    <div class="filter-row">
      <span class="filter-row-label">类型</span>
      <span class="chip active" data-type="all" onclick="setType('all')">全部</span>
    </div>
  </div>

  <div class="list">
    <div class="list-h">
      <div>档位</div><div>来源 <a class="heat-toggle" id="heatToggle" href="javascript:" onclick="toggleHeat()" title="当前：按热度降序——近30天点击最多的在最上面">热度↓</a></div><div>领域</div><div>类型</div><div>搜索策略</div><div>标签</div>
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
        <div class="principle-body">新陈代谢是活的标志。不用的沉底，404 淘汰。S = 近 30 天 ≥ 10 次点击（算法自动），A = 默认档位，X = 纯人工黑名单。每次点击都在为它投票——只进不出是垃圾场。</div>
      </div>
    </div>
  </div>

  <div class="arch-section">
    <div class="arch-section-label">架构：信息源怎么流动</div>
    <svg viewBox="0 0 1480 340" class="arch-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrowHead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0 0, 10 4, 0 8" fill="#d97757"/>
        </marker>
        <marker id="arrowFeedback" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <polygon points="0 0, 10 4, 0 8" fill="#999"/>
        </marker>
        <linearGradient id="pillGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#d97757"/>
          <stop offset="100%" stop-color="#0040c0"/>
        </linearGradient>
      </defs>

      <!-- ====== NODE 1: 发现 (terminator/pill) ====== -->
      <rect x="30" y="75" width="220" height="90" rx="45" fill="url(#pillGrad)" stroke="#d97757" stroke-width="2"/>
      <text x="140" y="112" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="17" font-weight="700">01 · 发现</text>
      <text x="140" y="135" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="system-ui,sans-serif" font-size="13">AI 对话 / 用户推荐</text>

      <!-- Arrow 1→2 -->
      <line x1="250" y1="120" x2="335" y2="120" stroke="#d97757" stroke-width="2" marker-end="url(#arrowHead)"/>

      <!-- ====== NODE 2: 收录 (process rect) ====== -->
      <rect x="345" y="75" width="220" height="90" rx="6" fill="#fff" stroke="#d97757" stroke-width="2"/>
      <rect x="345" y="75" width="6" height="90" rx="3" fill="#d97757"/>
      <text x="455" y="112" text-anchor="middle" fill="#222" font-family="system-ui,sans-serif" font-size="17" font-weight="700">02 · 收录</text>
      <text x="455" y="135" text-anchor="middle" fill="#666" font-family="system-ui,sans-serif" font-size="13">POST /sources 校验落盘</text>

      <!-- Arrow 2→3 -->
      <line x1="565" y1="120" x2="625" y2="120" stroke="#d97757" stroke-width="2" marker-end="url(#arrowHead)"/>

      <!-- ====== NODE 3: 存储 (cylinder/data shape) ====== -->
      <path d="M 635,80 A 110,15 0 0,0 855,80 L 855,150 A 110,15 0 0,1 635,150 Z" fill="#fdf5f2" stroke="#d97757" stroke-width="2"/>
      <ellipse cx="745" cy="80" rx="110" ry="15" fill="#fbe8df" stroke="#d97757" stroke-width="2"/>
      <text x="745" y="110" text-anchor="middle" fill="#222" font-family="system-ui,sans-serif" font-size="17" font-weight="700">03 · 存储</text>
      <text x="745" y="133" text-anchor="middle" fill="#666" font-family="system-ui,sans-serif" font-size="13">Obsidian .md YAML frontmatter</text>

      <!-- Arrow 3→4 -->
      <line x1="865" y1="120" x2="925" y2="120" stroke="#d97757" stroke-width="2" marker-end="url(#arrowHead)"/>

      <!-- ====== NODE 4: 查询 (process rect) ====== -->
      <rect x="935" y="75" width="220" height="90" rx="6" fill="#fff" stroke="#d97757" stroke-width="2"/>
      <rect x="935" y="75" width="6" height="90" rx="3" fill="#d97757"/>
      <text x="1045" y="112" text-anchor="middle" fill="#222" font-family="system-ui,sans-serif" font-size="17" font-weight="700">04 · 查询</text>
      <text x="1045" y="135" text-anchor="middle" fill="#666" font-family="system-ui,sans-serif" font-size="13">面板过滤 + AI grep 检索</text>

      <!-- Arrow 4→5 -->
      <line x1="1155" y1="120" x2="1215" y2="120" stroke="#d97757" stroke-width="2" marker-end="url(#arrowHead)"/>

      <!-- ====== NODE 5: 代谢 (process rect) ====== -->
      <rect x="1225" y="75" width="220" height="90" rx="6" fill="#fff" stroke="#d97757" stroke-width="2"/>
      <rect x="1225" y="75" width="6" height="90" rx="3" fill="#d97757"/>
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
  var subChips = document.querySelectorAll('.sub-chip');
  var TOP_DOMAINS = ['AI','设计','电商','开发工具','内容平台','商业','知识库'];
  var subRow = document.getElementById('subDomainRow');
  if (d === 'all') {
    subChips.forEach(function(c) { c.style.display = 'none'; });
    if (subRow) subRow.style.display = 'none';
  } else if (TOP_DOMAINS.indexOf(d) >= 0) {
    if (subRow) subRow.style.display = '';
    subChips.forEach(function(c) {
      var parents = (c.dataset.parents || '').split(' ');
      if (parents.indexOf(d) >= 0) {
        c.style.display = '';
        var pcs;
        try { pcs = JSON.parse(c.dataset.parentCounts || '{}'); } catch(e) { pcs = {}; }
        var count = pcs[d] || 0;
        var strong = c.querySelector('strong');
        if (strong) strong.textContent = count;
      } else {
        c.style.display = 'none';
      }
    });
  } else {
    // Secondary domain: show all sub-chips, restore global counts, highlight parents
    if (subRow) subRow.style.display = '';
    subChips.forEach(function(c) { c.style.display = ''; });
    subChips.forEach(function(c) {
      var gc = c.dataset.globalCount;
      var strong = c.querySelector('strong');
      if (strong && gc) strong.textContent = gc;
    });
    // Highlight parent primary chips for the selected secondary domain
    subChips.forEach(function(c) {
      if (c.dataset.domain === d) {
        var parents = (c.dataset.parents || '').split(' ');
        parents.forEach(function(p) {
          var parentChip = document.querySelector('.filter-row .chip[data-domain="' + p + '"]');
          if (parentChip) parentChip.classList.add('parent-active');
        });
      }
    });
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

  // Tier, type, and domain chip counts all stay at server-rendered global totals.
  // Only the visible row count changes with filtering.
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
    statusEl.textContent = '';
    if (gateBreaks > 0) {
      dot.classList.add('red');
      var cmd = document.createElement('span'); cmd.className = 'cmd'; cmd.textContent = '对AI说「修闸门」';
      statusEl.appendChild(cmd); statusEl.appendChild(document.createTextNode(' — ' + gateBreaks + ' 处受损'));
    } else if (warnings > 0) {
      dot.classList.add('yellow');
      var cmd = document.createElement('span'); cmd.className = 'cmd'; cmd.textContent = '对AI说「标准化」';
      statusEl.appendChild(cmd); statusEl.appendChild(document.createTextNode(' — ' + warnings + ' 处缺漏'));
    } else {
      dot.classList.add('green');
      statusEl.textContent = total + ' 源 · 唯一真相源自洽';
    }

    // Build checklist
    if (checksList) {
      checksList.textContent = '';
      allChecks.forEach(function(c) {
        var li = document.createElement('li');
        li.className = c.pass ? 'pass' : 'fail';
        li.textContent = (c.pass ? '✓' : '✗') + ' ' + c.label + '：' + c.detail;
        checksList.appendChild(li);
      });
      var legend = document.createElement('li'); legend.className = 'health-legend';
      legend.innerHTML = '<b class="hl-red">●</b> 源架受损（重复URL / 缺URL / 非法值）→ <span class="say">对AI说「修闸门」</span><br>' +
        '<b class="hl-yellow">●</b> 元数据不全（缺档位 / 缺类型 / 缺领域）→ <span class="say">对AI说「标准化」</span><br>' +
        '<b class="hl-green">●</b> 唯一真相源自洽，无需操作';
      checksList.appendChild(legend);
    }
  }).catch(function(err) {
    dot.classList.remove('loading');
    dot.classList.add('red');
    statusEl.textContent = '无法连接 — 刷新试试';
  });

  // Click tracking: fire touch on every source link click
  document.addEventListener('click', function(e) {
    var link = e.target.closest('.src-url');
    if (!link) return;
    var fname = link.dataset.file;
    if (!fname) return;
    fetch('/sources/touch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: fname })
    }).catch(function() { /* silent */ });
  });
});

var heatMode = 'hot'; // 'hot' | 'cold'

// Capture original server order on load
(function() {
  var rows = document.querySelectorAll('#listBody .row');
  for (var i = 0; i < rows.length; i++) { rows[i].dataset.origOrder = i; }
})();

function toggleHeat() {
  heatMode = heatMode === 'hot' ? 'cold' : 'hot';
  var btn = document.getElementById('heatToggle');
  btn.classList.remove('on');
  if (heatMode === 'hot') {
    btn.textContent = '热度↓';
    btn.title = '当前：按热度降序——近30天点击最多的在最上面';
  } else {
    btn.textContent = '热度↑';
    btn.title = '当前：按热度升序——近30天点击最少的在最上面';
    btn.classList.add('on');
  }

  var list = document.getElementById('listBody');
  var rows = Array.from(list.querySelectorAll('.row'));
  rows.sort(function(a, b) {
    var aC = parseInt(a.dataset.clicks, 10) || 0;
    var bC = parseInt(b.dataset.clicks, 10) || 0;
    return heatMode === 'hot' ? bC - aC : aC - bC;
  });
  rows.forEach(function(r) { list.appendChild(r); });
  applyFilters();
}
</script>
</body>
</html>`;

const SERVER_START_SCRIPT = `
const SOURCES_DIR = '${SOURCES_DIR.replace(/\\/g, '\\\\')}';
const TIER_ORDER = { S:0, A:1, X:2 };
`;

// ─── Auto-assign secondary domains (new 7-primary system) ───
const TOP_DOMAINS = PRIMARY_ORDER;
const topSet = new Set(TOP_DOMAINS);

function autoAssignSecondaries(domains, url, title) {
  var nd = normalizeDomains(domains, title, url);
  var result = [nd.primary];
  if (nd.secondary && nd.secondary !== '未细分') result.push(nd.secondary);
  result = result.concat(nd.crossTags);
  // Keep legacy secondary tags that aren't in new word list
  for (var i = 0; i < domains.length; i++) {
    if (!topSet.has(domains[i]) && result.indexOf(domains[i]) < 0) {
      result.push(domains[i]);
    }
  }
  return result;
}

function appFactory() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  // CSP: allow inline scripts & styles (current architecture), block everything else
  app.use(function(req, res, next) {
    res.set('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self'; " +
      "font-src 'self' data:; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'"
    );
    next();
  });

  // POST /sources — add a new source
  app.post('/sources', function(req, res) {
    const VALID_TIERS = ['S', 'A', 'X'];
    const VALID_TYPES = ['权威源', '聚合源', '平台', '社区', 'AI原生', '工具', '模板库', '工具站'];

    const b = req.body;
    var errors = [];

    if (!b.title || typeof b.title !== 'string') errors.push('title is required');
    if (!b.why || typeof b.why !== 'string' || b.why.trim().length < 6) errors.push('why is required (min 6 chars)');
    if (!VALID_TIERS.includes(b.tier)) errors.push('tier must be S, A, or X');
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

  // POST /sources/touch — update last_used + track click_dates (30-day window)
  app.post('/sources/touch', function(req, res) {
    var fname = req.body.file;
    if (!fname) return res.status(400).json({ ok: false, errors: ['file is required'] });
    var filePath = path.join(SOURCES_DIR, fname);
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, errors: ['file not found: ' + fname] });
    var raw = fs.readFileSync(filePath, 'utf8');
    var today = new Date().toISOString().slice(0, 10);
    var updated = raw;
    if (!/^---\n[\s\S]*?---\n/.test(raw)) {
      return res.status(400).json({ ok: false, errors: ['no frontmatter found'] });
    }
    // Update last_used
    if (/last_used:/.test(updated)) {
      updated = updated.replace(/(last_used:\s*).*/, '$1' + today);
    } else if (/^added:/.test(updated)) {
      updated = updated.replace(/^(added:.*\n)/m, '$1last_used: ' + today + '\n');
    } else {
      updated = updated.replace(/^(url:.*\n)/m, '$1last_used: ' + today + '\n');
    }
    // Increment total click_count (historical, kept for reference)
    if (/click_count:/.test(updated)) {
      updated = updated.replace(/click_count:\s*(\d+)/, function(m, n) { return 'click_count: ' + (parseInt(n, 10) + 1); });
    } else {
      updated = updated.replace(/^(last_used:.*\n)/m, '$1click_count: 1\n');
    }
    // Maintain click_dates — last 30 days only
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    var cutoffStr = cutoff.toISOString().slice(0, 10);
    if (/click_dates:/.test(updated)) {
      // Append today, prune old dates
      var datesMatch = updated.match(/click_dates:\s*\[([^\]]*)\]/);
      if (datesMatch) {
        var dates = datesMatch[1].split(',').map(function(s) { return s.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'); }).filter(Boolean);
        dates.push(today);
        // Deduplicate and keep only dates >= cutoff
        var seen = {};
        var filtered = [];
        for (var i = dates.length - 1; i >= 0; i--) {
          if (dates[i] >= cutoffStr && !seen[dates[i]]) { filtered.unshift(dates[i]); seen[dates[i]] = true; }
        }
        updated = updated.replace(/click_dates:\s*\[[^\]]*\]/, 'click_dates: [' + filtered.join(', ') + ']');
        var recent = filtered.length;
      }
    } else {
      updated = updated.replace(/^(last_used:.*\n)/m, '$1click_dates: [' + today + ']\n');
      var recent = 1;
    }
    fs.writeFileSync(filePath, updated, 'utf8');
    res.json({ ok: true, file: fname, last_used: today, click_count: parseInt((updated.match(/click_count:\s*(\d+)/) || [0,0])[1], 10), recent: recent || 1 });
  });

  // GET /sources/stale — sources sorted by staleness (candidates for cleanup)
  app.get('/sources/stale', function(req, res) {
    var days = parseInt(req.query.days, 10) || 90;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    var cutoffStr = cutoff.toISOString().slice(0, 10);
    var sources = scanSources();
    var stale = sources.filter(function(s) {
      if (s.tier === 'X') return false;
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
      // Within same tier: recent clicks (30d) desc, then last_used desc, then added desc
      var aRC = countRecentClicks(a);
      var bRC = countRecentClicks(b);
      if (aRC !== bRC) return bRC - aRC;
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

    // Build domain chips — from normalized _primary / _secondary
    const domainCounts = {};
    const secondaryCounts = {};
    const secondaryParents = {}; // secondary → { primary: count }
    sources.forEach(function(s) {
      var p = s._primary || '未分类';
      domainCounts[p] = (domainCounts[p] || 0) + 1;
      // crossTags also count toward their respective primary chip numbers,
      // matching the filter behavior where clicking a domain chip matches
      // crossTags in data-domain as well.
      var tags = s._crossTags || [];
      for (var i = 0; i < tags.length; i++) {
        domainCounts[tags[i]] = (domainCounts[tags[i]] || 0) + 1;
      }
      var sec = s._secondary || '未细分';
      if (sec !== '未细分') {
        secondaryCounts[sec] = (secondaryCounts[sec] || 0) + 1;
        if (!secondaryParents[sec]) secondaryParents[sec] = {};
        secondaryParents[sec][p] = (secondaryParents[sec][p] || 0) + 1;
      }
    });

    const DOMAIN_ORDER = PRIMARY_ORDER;
    const topDomains = new Set(DOMAIN_ORDER);

    const domainTips = PRIMARY_TIPS;

    // ─── Domain icons (inline SVG, 14×14, stroke=currentColor) ───
    const DOMAIN_ICONS = {};
    for (var di = 0; di < PRIMARY_ORDER.length; di++) {
      DOMAIN_ICONS[PRIMARY_ORDER[di]] = PRIMARY_ICONS[PRIMARY_ORDER[di]] || '';
    }

    function domainIcon(d) {
      if (DOMAIN_ICONS[d]) return '<span class="domain-icon">' + DOMAIN_ICONS[d] + '</span>';
      // Secondary: inherit icon from first parent primary
      var parents = secondaryParents[d];
      if (parents) {
        for (var pi = 0; pi < PRIMARY_ORDER.length; pi++) {
          if (parents[PRIMARY_ORDER[pi]]) return '<span class="domain-icon">' + DOMAIN_ICONS[PRIMARY_ORDER[pi]] + '</span>';
        }
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

    const subList = Object.keys(secondaryCounts)
      .sort(function(a, b) { return (secondaryCounts[b]||0) - (secondaryCounts[a]||0); });
    let subChipsHTML = '<span class="filter-row-label">二级</span>\n';
    if (subList.length === 0) {
      subChipsHTML += '<span class="chip dim">—</span>';
    } else {
      subList.forEach(function(d) {
        const n = secondaryCounts[d] || 0;
        const parents = secondaryParents[d] ? Object.keys(secondaryParents[d]).join(' ') : '';
        const parentCountsJson = secondaryParents[d] ? JSON.stringify(secondaryParents[d]).replace(/"/g, '&quot;') : '{}';
        const icon = domainIcon(d);
        subChipsHTML += '<span class="chip sub-chip" data-domain="' + esc(d) + '" data-parents="' + esc(parents) + '" data-global-count="' + n + '" data-parent-counts="' + parentCountsJson + '" onclick="setDomain(\'' + esc(d) + '\')">' + icon + esc(d) + ' <strong>' + n + '</strong></span>\n';
      });
    }

    // Build tier chips
    const tierCounts = {};
    sources.forEach(function(s) { if (s.tier) tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1; });
    const tierLabels = { S: 'S 高频信源', A: 'A 常规信源', X: 'X 黑名单' };
    const tierTips = {
      S: '算法判定：近 30 天点击 ≥ 10 次自动升 S。不用即掉回 A——S 是状态，不是勋章。也可人工 tier_override 锁定',
      A: '算法判定：默认档位。新源从此起步，持续使用冲 S，不用停留在 A',
      X: '纯人工档位。只有 tier_override: X 才会进入。算法永不会自动标记 X',
    };
    let tierChipsHTML = '<span class="filter-row-label">档位</span>\n<span class="chip active" data-tier="all" onclick="setTier(\'all\')">全部</span>\n';
    ['S', 'A', 'X'].forEach(function(t) {
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
      const host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
      const letter = (host[0] || '?').toUpperCase();
      // Inline SVG placeholder — no external requests, GFW-safe
      const colors = ['#d97757','#509070','#4a7db0','#b0885c','#7b68ae','#c4576a','#5a8a6a','#b8804e'];
      var hash = 0;
      for (var i = 0; i < host.length; i++) { hash = ((hash << 5) - hash) + host.charCodeAt(i); hash |= 0; }
      const color = colors[Math.abs(hash) % colors.length];
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="' + color + '" opacity="0.15"/><text x="10" y="14" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="' + color + '">' + esc(letter) + '</text></svg>';
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
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
        // Normalized domain display: primary + secondary + cross
        const domainsArr = s._primary ? [s._primary] : [];
        if (s._secondary && s._secondary !== '未细分') domainsArr.push(s._secondary);
        if (s._crossTags) domainsArr.push.apply(domainsArr, s._crossTags);
        const domainBadges = domainsArr.length === 0
          ? '<span class="cell-chip muted">—</span>'
          : domainsArr.map(function(d) { return '<span class="cell-chip clickable domain-badge" onclick="event.stopPropagation();setDomain(\'' + esc(d) + '\')" title="按领域筛选：' + esc(d) + '">' + esc(d) + '</span>'; }).join('');
        const fv = favicon(s.url);
        const stype = s.source_type || '';
        return '<div class="row' + staleClass(s) + '" data-tier="' + esc(s.tier||'') + '" data-domain="' + esc(domainsArr.join(' ')) + '" data-type="' + esc(stype) + '" data-clicks="' + countRecentClicks(s) + '" data-text="' + esc((s.title||'') + ' ' + (s.url||'') + ' ' + (s.tags||[]).join(' ') + ' ' + domainsArr.join(' ')) + '">' +
          '<div class="tier-badge ' + badgeClass(s.tier) + '" title="' + (s.tier_override ? '人工锁定: ' + s.tier_override : '算法判定: 近30天点击' + (function(){var rc=countRecentClicks(s);return rc;})() + '次 (累计' + (s.click_count||0) + ')') + '">' + esc(s.tier||'?') + '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;"><img class="favicon" src="' + fv + '" width="20" height="20" loading="lazy" onerror="this.style.display=\'none\'"><div><div class="src-name">' + esc(s.title||s.file||'') + (function(){var rc=countRecentClicks(s);return rc>0?' <span class="click-badge'+(rc>=10?' click-hot':rc>=5?' click-warm':'')+'" title="近30天 '+rc+' 次 (累计'+(s.click_count||0)+')">'+rc+'</span>':'';})() + staleLabel(s) + '</div><a class="src-url" href="' + esc(hrefUrl(s.url||'')) + '" target="_blank" rel="noopener" data-file="' + esc(s.file||'') + '">' + esc(displayUrl(s.url||'')) + '</a>' + (s.desc ? '<div class="src-desc">' + esc(s.desc) + '</div>' : '') + '</div></div>' +
          '<div class="domain-cell">' + domainBadges + '</div>' +
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
    const VALID_TIERS = ['S', 'A', 'X'];
    const VALID_TYPES = ['权威源', '聚合源', '平台', '社区', 'AI原生', '工具', '模板库', '工具站'];

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
    const missingDomains = sources.filter(function(s) { return !s._primary || !isValidPrimary(s._primary); });
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
  app.listen(PORT, '127.0.0.1', function() {
    console.log('\n📡 Source Rack · http://localhost:' + PORT);
    console.log('📂 Scanning: ' + SOURCES_DIR);
    console.log('📄 ' + scanSources().length + ' sources found\n');
  });
}

module.exports = { appFactory, scanSources };
