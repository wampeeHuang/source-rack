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

const archSvg = fs.readFileSync(path.join(__dirname, 'references/architecture.svg'), 'utf8');

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Source Rack — 信息源管理</title>
<link rel="icon" type="image/svg+xml" href="/logo.svg">
<link rel="stylesheet" href="/tokens/brand.css">
<link rel="stylesheet" href="/tokens/layout.css">
<link rel="stylesheet" href="/app.css">
</head>
<body data-total-count="SOURCES_PLACEHOLDER_COUNT" data-graph="GRAPH_DATA_PLACEHOLDER">

<!-- ═══ Zone 1: Header ═══ -->
<header class="header">
  <div class="header-brand">
    <img class="logo-mark" src="/logo.svg" width="32" height="32" alt="信息源管理">
    <div class="header-title">
      <h1>信息源管理</h1>
      <div class="header-status" id="healthChecks">
        <details>
          <summary>
            <span id="healthDot" class="health-dot loading"></span>
            <span id="healthStatus" class="health-status">检查中…</span>
          </summary>
          <ul id="healthChecksList" class="health-checks-list"></ul>
        </details>
      </div>
    </div>
  </div>
  <div class="header-tools">
    <button class="view-btn active" data-view="list" data-action="toggleView" data-value="list">列表</button>
    <button class="view-btn" data-view="graph" data-action="toggleView" data-value="graph">图谱</button>
  </div>
</header>

<!-- ═══ Zone 2: Filter Bar ═══ -->
<div class="container">
  <nav class="filter-bar">
    <div class="filter-row">TIER_CHIPS_ROW</div>
    <div class="filter-row">DOMAIN_TOP_ROW</div>
    <div class="filter-row" id="subDomainRow">DOMAIN_SUB_ROW</div>
    <div class="filter-row">
      <span class="filter-row-label">类型</span>
      <span class="chip active" data-type="all" data-action="setType" data-value="all">全部</span>
    </div>
    <div class="filter-row">
      <span class="filter-row-label">搜索</span>
      <input type="text" id="searchInput" class="search-input" placeholder="输入关键词即时筛选…" oninput="applyFilters()">
      <button class="search-btn" data-action="applyFilters" title="筛选">&#x2315;</button>
    </div>
  </nav>

  <!-- ═══ Zone 3: Data Table ═══ -->
  <div class="list" id="listView">
    <div class="list-header">
      <div class="list-header-cell col-tier">档位</div>
      <div class="list-header-cell col-source">
        来源
        <a class="heat-toggle" id="heatToggle" href="#" data-action="toggleHeat" title="当前：按热度降序——近30天点击最多的在最上面">热度↓</a>
      </div>
      <div class="list-header-cell col-domain">领域</div>
      <div class="list-header-cell col-type">类型</div>
      <div class="list-header-cell col-strategy">搜索策略</div>
      <div class="list-header-cell col-tags">标签</div>
    </div>
    <div id="listBody">SOURCES_PLACEHOLDER_ROWS</div>
  </div>
</div>

<!-- ═══ Graph View ═══ -->
<div class="graph-container" id="graphView" hidden>
  <aside class="graph-panel" id="graphPanel">
    <div class="graph-panel-header">
      <h3 id="graphPanelTitle">标签节点</h3>
      <button class="graph-panel-clear" data-action="graphPanelClear" title="清除选择">&#x2715;</button>
    </div>
    <div class="graph-panel-list" id="graphPanelList">
      <div class="graph-panel-hint">点击图谱中的标签查看相关源</div>
    </div>
  </aside>
  <div class="graph-resize-handle" id="graphResizeHandle"></div>
  <div class="graph-svg-area">
    <svg id="graphSvg" viewBox="0 0 800 600" preserveAspectRatio="xMinYMid meet">
      <g id="graphWorld"></g>
    </svg>
  </div>
</div>

<!-- ═══ Zone 4: Footer ═══ -->
<footer class="doc-footer" id="docFooter">
  <div class="doc-content" id="docContent">
    <!-- Architecture Diagram -->
    <div class="arch-section">
    <div class="arch-section-label">架构：信息源怎么流动</div>
    ${archSvg}
  </div>

    <!-- Rules Grid -->
    <div class="doc-grid">
      <div class="doc-section">
        <div class="doc-section-title">收录标准</div>
        <ol class="doc-list">
          <li><strong>一手优先</strong> — 原创/权威源，不收转载聚合站</li>
          <li><strong>领域相关</strong> — 与当前工作领域至少一项交集</li>
          <li><strong>有 why</strong> — why 字段必填，不加理由的源不收</li>
          <li><strong>持续更新</strong> — 更新频率 ≥ 月更</li>
          <li><strong>URL 完整</strong> — 必须是完整 https:// 地址</li>
        </ol>
      </div>
      <div class="doc-section">
        <div class="doc-section-title">档位定义</div>
        <div class="doc-table-wrap">
          <table class="doc-table">
            <thead><tr><th>档位</th><th>含义</th><th>算法规则</th></tr></thead>
            <tbody>
              <tr><td><span class="tier-badge tier-s">S</span></td><td>高频信源</td><td>近30天点击 ≥ 10 次自动升S。不用即掉回A——时间会自然淘汰</td></tr>
              <tr><td><span class="tier-badge tier-a">A</span></td><td>常规信源</td><td>默认档位。新源从此起步，持续使用冲S</td></tr>
              <tr><td><span class="tier-badge tier-x">X</span></td><td>黑名单</td><td>纯人工档位。只有 tier_override: X 才进入。算法永不会自动标记X</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="doc-section">
        <div class="doc-section-title">领域分类</div>
        <p class="doc-text">两级分类体系。7个一级领域：AI、设计、电商、开发工具、内容平台、商业、知识库。每个一级下有闭合二级词表。完整标签全集定义在 <code>domain-registry.js</code>（唯一真相源），运行 <code>node -e "require('./domain-registry')"</code> 查看。</p>
      </div>
      <div class="doc-section">
        <div class="doc-section-title">新陈代谢规则</div>
        <div class="doc-table-wrap">
          <table class="doc-table">
            <thead><tr><th>条件</th><th>动作</th></tr></thead>
            <tbody>
              <tr><td>last_used 空缺 + added > 90天</td><td>标记 stale，UI 半透明沉底</td></tr>
              <tr><td>last_used > 90天（S档）</td><td>人工审查，不再用则降级为A</td></tr>
              <tr><td>last_used > 90天（A档）</td><td>候选删除，清理时优先删</td></tr>
              <tr><td>URL 返回 4xx/5xx</td><td>标记 dead，404 直接删</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="note">SOURCES_PLACEHOLDER_DIR · frontmatter 驱动 · 每个 .md 一个源</div>
  </div>
</footer>

<button class="back-to-top" id="backToTop" data-action="backToTop" title="返回顶部">&#x25B2;</button>

<script src="/app.js"></script>
</body>
</html>`;


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

  // Static files: external CSS/JS + token files
  app.use(express.static(path.join(__dirname, 'assets')));
  app.use('/tokens', express.static(path.join(__dirname, 'assets/tokens')));

  // CSP: no unsafe-inline. All JS in external files, event handlers via delegation.
  app.use(function(req, res, next) {
    res.set('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self'; " +
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

    // Auto-fill defaults for missing fields — only URL is required
    if (!b.title || typeof b.title !== 'string') {
      var host = (b.url || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
      b.title = host || '未命名来源';
    }
    if (!b.why || typeof b.why !== "string") b.why = "待补充";
    if (!VALID_TIERS.includes(b.tier)) b.tier = "A";
    if (!Array.isArray(b.domains) || b.domains.length === 0) b.domains = ["参考"];
    if (!VALID_TYPES.includes(b.source_type)) b.source_type = "聚合源";
    if (!Array.isArray(b.tags) || b.tags.length === 0) b.tags = ["未分类"];
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

    let topChipsHTML = '<span class="filter-row-label">领域</span>\n<span class="chip active" data-domain="all" data-action="setDomain" data-value="all">全部</span>\n';
    DOMAIN_ORDER.forEach(function(d) {
      const n = domainCounts[d] || 0;
      const dim = n === 0 ? ' dim' : '';
      const tip = domainTips[d] || '';
      const icon = DOMAIN_ICONS[d] ? '<span class="domain-icon">' + DOMAIN_ICONS[d] + '</span>' : '';
      topChipsHTML += '<span class="chip' + dim + '" data-domain="' + esc(d) + '" data-action="setDomain" data-value="' + esc(d) + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + icon + esc(d) + ' <strong>' + n + '</strong></span>\n';
    });

    const subList = Object.keys(secondaryCounts)
      .sort(function(a, b) { return (secondaryCounts[b]||0) - (secondaryCounts[a]||0); });
    let subChipsHTML = '<span class="filter-row-label">子领域</span>\n';
    if (subList.length === 0) {
      subChipsHTML += '<span class="chip dim">—</span>';
    } else {
      subList.forEach(function(d) {
        const n = secondaryCounts[d] || 0;
        const parents = secondaryParents[d] ? Object.keys(secondaryParents[d]).join(' ') : '';
        const parentCountsJson = secondaryParents[d] ? JSON.stringify(secondaryParents[d]).replace(/"/g, '&quot;') : '{}';
        const icon = domainIcon(d);
        subChipsHTML += '<span class="chip sub-chip" data-domain="' + esc(d) + '" data-parents="' + esc(parents) + '" data-global-count="' + n + '" data-parent-counts="' + parentCountsJson + '" data-action="setDomain" data-value="' + esc(d) + '">' + icon + esc(d) + ' <strong>' + n + '</strong></span>\n';
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
    let tierChipsHTML = '<span class="filter-row-label">档位</span>\n<span class="chip active" data-tier="all" data-action="setTier" data-value="all">全部</span>\n';
    ['S', 'A', 'X'].forEach(function(t) {
      const n = tierCounts[t] || 0;
      const tip = tierTips[t] || '';
      tierChipsHTML += '<span class="chip" data-tier="' + t + '" data-action="setTier" data-value="' + t + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + tierLabels[t] + ' <strong>' + n + '</strong></span>\n';
    });
    tierChipsHTML += '<span class="count-badge" id="countDisplay"></span>';

    // ── Tag graph data ──
    var tagFreq = {};
    var tagCooccur = {};
    sources.forEach(function(s) {
      var tags = s.tags || [];
      for (var ti = 0; ti < tags.length; ti++) {
        var t = tags[ti];
        tagFreq[t] = (tagFreq[t] || 0) + 1;
        if (!tagCooccur[t]) tagCooccur[t] = {};
        for (var tj = 0; tj < tags.length; tj++) {
          if (ti !== tj) tagCooccur[t][tags[tj]] = (tagCooccur[t][tags[tj]] || 0) + 1;
        }
      }
    });
    var topTags = Object.keys(tagFreq).sort(function(a,b) { return tagFreq[b] - tagFreq[a]; }).slice(0, 60);
    var nodeMap = {};
    topTags.forEach(function(t, i) { nodeMap[t] = i; });
    var graphEdges = [];
    for (var i = 0; i < topTags.length; i++) {
      for (var j = i + 1; j < topTags.length; j++) {
        var w = (tagCooccur[topTags[i]] && tagCooccur[topTags[i]][topTags[j]]) || 0;
        if (w >= 2) graphEdges.push({ source: i, target: j, weight: Math.min(w, 10) });
      }
    }
    var graphData = JSON.stringify({
      nodes: topTags.map(function(t) { return { id: t, count: tagFreq[t] }; }),
      edges: graphEdges
    });

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
    let typeChips = '<span class="chip active" data-type="all" data-action="setType" data-value="all">全部</span>\n';
    const typeOrder = ['权威源', '聚合源', '平台', '社区', 'AI原生'];
    typeOrder.forEach(function(t) {
      const n = types[t] || 0;
      const tip = typeTips[t] || '';
      if (n > 0) typeChips += '<span class="chip" data-type="' + esc(t) + '" data-action="setType" data-value="' + esc(t) + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + esc(t) + ' <strong>' + n + '</strong></span>\n';
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
      const google = 'https://www.google.com/s2/favicons?domain=' + host + '&sz=32';
      const letter = (host[0] || '?').toUpperCase();
      const colors = ['#d97757','#509070','#4a7db0','#b0885c','#7b68ae','#c4576a','#5a8a6a','#b8804e'];
      var hash = 0;
      for (var i = 0; i < host.length; i++) { hash = ((hash << 5) - hash) + host.charCodeAt(i); hash |= 0; }
      const color = colors[Math.abs(hash) % colors.length];
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="' + color + '" opacity="0.15"/><text x="10" y="14" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="' + color + '">' + esc(letter) + '</text></svg>';
      const fallback = 'data:image/svg+xml,' + encodeURIComponent(svg);
      return { src: google, fallback: fallback };
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
          return '<span class="tag clickable" data-action="setSearch" data-value="' + esc(t) + '">' + esc(t) + '</span>';
        }).join('');
        // Normalized domain display: primary + secondary + cross
        const domainsArr = s._primary ? [s._primary] : [];
        if (s._secondary && s._secondary !== '未细分') domainsArr.push(s._secondary);
        if (s._crossTags) domainsArr.push.apply(domainsArr, s._crossTags);
        const domainBadges = domainsArr.length === 0
          ? '<span class="cell-chip muted">—</span>'
          : domainsArr.map(function(d) { return '<span class="cell-chip clickable domain-badge" data-action="setDomain" data-value="' + esc(d) + '" title="按领域筛选：' + esc(d) + '">' + esc(d) + '</span>'; }).join('');
        const fv = favicon(s.url);
        const stype = s.source_type || '';
        return '<div class="row' + staleClass(s) + '" data-tier="' + esc(s.tier||'') + '" data-domain="' + esc(domainsArr.join(' ')) + '" data-type="' + esc(stype) + '" data-clicks="' + countRecentClicks(s) + '" data-text="' + esc((s.title||'') + ' ' + (s.url||'') + ' ' + (s.tags||[]).join(' ') + ' ' + domainsArr.join(' ')) + '">' +
          '<div class="tier-badge ' + badgeClass(s.tier) + '" title="' + (s.tier_override ? '人工锁定: ' + s.tier_override : '算法判定: 近30天点击' + (function(){var rc=countRecentClicks(s);return rc;})() + '次 (累计' + (s.click_count||0) + ')') + '">' + esc(s.tier||'?') + '</div>' +
          '<div class="src-info"><img class="favicon" src="' + esc(fv.src) + '" width="20" height="20" loading="lazy" onerror="this.onerror=null;this.src=\'' + fv.fallback + '\'"><div><div class="src-name">' + esc(s.title||s.file||'') + (function(){var rc=countRecentClicks(s);return rc>0?' <span class="click-badge'+(rc>=10?' click-hot':rc>=5?' click-warm':'')+'" title="近30天 '+rc+' 次 (累计'+(s.click_count||0)+')">'+rc+'</span>':'';})() + staleLabel(s) + '</div><a class="src-url" href="' + esc(hrefUrl(s.url||'')) + '" target="_blank" rel="noopener" data-file="' + esc(s.file||'') + '">' + esc(displayUrl(s.url||'')) + '</a>' + (s.desc ? '<div class="src-desc">' + esc(s.desc) + '</div>' : '') + '</div></div>' +
          '<div class="domain-cell">' + domainBadges + '</div>' +
          '<div><span class="cell-chip clickable src-type" data-action="setType" data-value="' + esc(stype) + '" title="按类型筛选：' + esc(stype) + '">' + esc(stype) + '</span></div>' +
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
    html = html.replace('GRAPH_DATA_PLACEHOLDER', graphData.replace(/"/g, '&quot;'));
    html = html.replace('<span class="chip active" data-type="all" data-action="setType" data-value="all">全部</span>',
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
