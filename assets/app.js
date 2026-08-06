/* ═══════════════════════════════════════════════════════════════════
   Source Rack — 客户端脚本
   筛选 · 排序 · Health · 文档面板
   ═══════════════════════════════════════════════════════════════════ */

// ── Constants ──
const TOP_DOMAINS = ['AI', '设计', '电商', '开发工具', '内容平台', '商业', '知识库'];

// ── State ──
let tier = 'all';
let domain = 'all';
let stype = 'all';
let heatMode = 'hot';

// ── Read total count injected by server ──
let totalCount = parseInt(document.body.dataset.totalCount, 10) || 0;

// ═══════════════════════════════════════════════════════════════════
// Filter toggles
// ═══════════════════════════════════════════════════════════════════

function setTier(t) {
  tier = t;
  document.querySelectorAll('.filter-row .chip[data-tier]').forEach(function(c) {
    c.classList.toggle('active', c.dataset.tier === t);
  });
  applyFilters();
}

function setDomain(d) {
  domain = d;
  document.querySelectorAll('.filter-row .chip[data-domain]').forEach(function(c) {
    c.classList.remove('active', 'parent-active');
  });
  var clicked = document.querySelector('.filter-row .chip[data-domain="' + d + '"]');
  if (clicked) clicked.classList.add('active');

  var subChips = document.querySelectorAll('.sub-chip');
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
    if (subRow) subRow.style.display = '';
    subChips.forEach(function(c) { c.style.display = ''; });
    subChips.forEach(function(c) {
      var gc = c.dataset.globalCount;
      var strong = c.querySelector('strong');
      if (strong && gc) strong.textContent = gc;
    });
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

// ═══════════════════════════════════════════════════════════════════
// Core filter logic
// ═══════════════════════════════════════════════════════════════════

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
  if (el) el.textContent = visible + ' / ' + totalCount;
}

// ═══════════════════════════════════════════════════════════════════
// Heat sort toggle
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// Health check
// ═══════════════════════════════════════════════════════════════════

function fetchHealth() {
  var dot = document.getElementById('healthDot');
  var statusEl = document.getElementById('healthStatus');
  var checksList = document.getElementById('healthChecksList');
  if (!dot || !statusEl) return;

  fetch('/health').then(function(r) { return r.json(); }).then(function(h) {
    dot.classList.remove('loading');
    var gateBreaks = h.gate_breaks ? h.gate_breaks.length : 0;
    var warnings = h.warnings ? h.warnings.length : 0;
    var total = h.total || 0;

    var allChecks = [
      { label: '文件总数', pass: true, detail: total + ' 个源' },
      { label: 'URL 无重复', pass: true, detail: '0 重复' },
      { label: 'URL 无缺失', pass: true, detail: '0 缺URL' },
      { label: '档位无缺失', pass: true, detail: '0 缺档位' },
      { label: '类型无缺失', pass: true, detail: '0 缺类型' },
      { label: '领域无缺失', pass: true, detail: '0 缺领域' },
      { label: '枚举值合法', pass: true, detail: '0 非法值' }
    ];

    var issueMap = {};
    (h.gate_breaks || []).concat(h.warnings || []).forEach(function(iss) { issueMap[iss.rule] = iss; });
    if (issueMap['duplicate_urls']) { allChecks[1].pass = false; allChecks[1].detail = issueMap['duplicate_urls'].count + ' 重复'; }
    if (issueMap['missing_url'])    { allChecks[2].pass = false; allChecks[2].detail = issueMap['missing_url'].count + ' 缺URL'; }
    if (issueMap['missing_tier'])   { allChecks[3].pass = false; allChecks[3].detail = issueMap['missing_tier'].count + ' 缺档位'; }
    if (issueMap['missing_type'])   { allChecks[4].pass = false; allChecks[4].detail = issueMap['missing_type'].count + ' 缺类型'; }
    if (issueMap['empty_domains'])  { allChecks[5].pass = false; allChecks[5].detail = issueMap['empty_domains'].count + ' 缺领域'; }
    if (issueMap['invalid_tiers'] || issueMap['invalid_types']) {
      allChecks[6].pass = false;
      var iv = (issueMap['invalid_tiers'] ? issueMap['invalid_tiers'].count : 0) + (issueMap['invalid_types'] ? issueMap['invalid_types'].count : 0);
      allChecks[6].detail = iv + ' 非法值';
    }

    statusEl.textContent = '';
    if (gateBreaks > 0) {
      dot.classList.add('red');
      var cmd = document.createElement('span');
      cmd.className = 'cmd';
      cmd.textContent = '对AI说「修闸门」';
      statusEl.appendChild(cmd);
      statusEl.appendChild(document.createTextNode(' — ' + gateBreaks + ' 处受损'));
    } else if (warnings > 0) {
      dot.classList.add('yellow');
      var cmd = document.createElement('span');
      cmd.className = 'cmd';
      cmd.textContent = '对AI说「标准化」';
      statusEl.appendChild(cmd);
      statusEl.appendChild(document.createTextNode(' — ' + warnings + ' 处缺漏'));
    } else {
      dot.classList.add('green');
      statusEl.textContent = total + ' 源 · 唯一真相源自洽';
    }

    if (checksList) {
      checksList.textContent = '';
      allChecks.forEach(function(c) {
        var li = document.createElement('li');
        li.className = c.pass ? 'pass' : 'fail';
        li.textContent = (c.pass ? '✓' : '✗') + ' ' + c.label + '：' + c.detail;
        checksList.appendChild(li);
      });
      var legend = document.createElement('li');
      legend.className = 'health-legend';
      legend.innerHTML = '<b class="hl-red">●</b> 源架受损（重复URL / 缺URL / 非法值）→ <span class="say">对AI说「修闸门」</span><br>' +
        '<b class="hl-yellow">●</b> 元数据不全（缺档位 / 缺类型 / 缺领域）→ <span class="say">对AI说「标准化」</span><br>' +
        '<b class="hl-green">●</b> 唯一真相源自洽，无需操作';
      checksList.appendChild(legend);
    }
  }).catch(function() {
    dot.classList.remove('loading');
    dot.classList.add('red');
    statusEl.textContent = '无法连接 — 刷新试试';
  });
}

// ═══════════════════════════════════════════════════════════════════
// Click tracking
// ═══════════════════════════════════════════════════════════════════

function setupClickTracking() {
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
}

// ═══════════════════════════════════════════════════════════════════
// Action delegation — replaces inline onclick handlers (CSP-safe)
// ═══════════════════════════════════════════════════════════════════

function setupActionDelegation() {
  document.addEventListener('click', function(e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    e.stopPropagation();
    e.preventDefault();
    var action = el.dataset.action;
    var value = el.dataset.value;
    switch (action) {
      case 'setTier': setTier(value); break;
      case 'setDomain': setDomain(value); break;
      case 'setType': setType(value); break;
      case 'setSearch': setSearch(value); break;
      case 'applyFilters': applyFilters(); break;
      case 'toggleHeat': toggleHeat(); break;
      case 'graphNodeClick': showGraphPanel(value); break;
      case 'graphPanelClear': clearGraphPanel(); break;
      case 'toggleView': toggleView(value); break;
      case 'backToTop': window.scrollTo({top:0,behavior:'smooth'}); break;
    }
  });

  // Favicon error fallback
  document.addEventListener('error', function(e) {
    if (e.target.hasAttribute('data-error-hide')) {
      e.target.style.display = 'none';
    }
  }, true);
}

// ═══════════════════════════════════════════════════════════════════
// Documentation footer toggle
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// Bootstrap
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// Tag Graph — force-directed visualization
// ═══════════════════════════════════════════════════════════════════

var graphNodes = [];
var graphEdges = [];
var graphAdj = [];
var graphRunning = false;
var graphRaf = null;
var graphDrag = null;
var graphZoom = 1;
var graphPanX = 0;
var graphPanY = 0;
var graphHoverIdx = -1;

function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function initGraph() {
  var raw = document.body.dataset.graph;
  if (!raw) return;
  var data;
  try { data = JSON.parse(raw); } catch(e) { return; }
  var nodes = data.nodes || [];
  var edges = data.edges || [];
  if (nodes.length === 0) return;

  var maxCount = nodes[0].count;
  var minCount = nodes[nodes.length - 1].count;
  var countRange = maxCount - minCount || 1;

  // Spiral initial placement — stable starting positions
  var cx = 400, cy = 300;
  graphNodes = nodes.map(function(n, i) {
    var fontSize = 10 + ((n.count - minCount) / countRange) * 8;
    var tw = 0;
    for (var ci = 0; ci < n.id.length; ci++) {
      var code = n.id.charCodeAt(ci);
      tw += (code > 127) ? fontSize * 1.0 : fontSize * 0.6;
    }
    var r = Math.max(16, tw / 2 + 8);
    var angle = i * 2.4; // golden-angle-ish spiral
    var radius = 40 + i * 8;
    return {
      id: n.id, count: n.count, r: r, fontSize: fontSize, fixed: false,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: 0, vy: 0
    };
  });

  graphEdges = edges.map(function(e) {
    return { source: e.source, target: e.target, weight: e.weight };
  });

  // Adjacency map for hover highlighting
  graphAdj = [];
  for (var ei = 0; ei < graphEdges.length; ei++) {
    var s = graphEdges[ei].source, t = graphEdges[ei].target;
    if (!graphAdj[s]) graphAdj[s] = {};
    if (!graphAdj[t]) graphAdj[t] = {};
    graphAdj[s][t] = true;
    graphAdj[t][s] = true;
  }
}

function startGraph() {
  if (graphNodes.length === 0) initGraph();
  if (graphRunning) return;
  graphRunning = true;
  function step() {
    if (!graphRunning) return;
    simulateTick();
    renderGraph();
    graphRaf = requestAnimationFrame(step);
  }
  graphRaf = requestAnimationFrame(step);
}

function stopGraph() {
  graphRunning = false;
  if (graphRaf) { cancelAnimationFrame(graphRaf); graphRaf = null; }
}

function simulateTick() {
  var nodes = graphNodes;
  var n = nodes.length;
  var w = 800, h = 600;
  var cx = w / 2, cy = h / 2;

  for (var i = 0; i < n; i++) {
    var ni = nodes[i];
    if (ni.fixed) continue;

    // Gentle center gravity
    ni.vx += (cx - ni.x) * 0.0006;
    ni.vy += (cy - ni.y) * 0.0006;

    // Repulsion (gentle)
    for (var j = 0; j < n; j++) {
      if (i === j) continue;
      var dx = ni.x - nodes[j].x;
      var dy = ni.y - nodes[j].y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var minDist = ni.r + nodes[j].r + 4;
      if (dist < minDist) dist = minDist;
      var force = 350 / (dist * dist);
      ni.vx += (dx / dist) * force;
      ni.vy += (dy / dist) * force;
    }

    // Micro-jiggle — "breathing" organic feel
    ni.vx += (Math.random() - 0.5) * 0.06;
    ni.vy += (Math.random() - 0.5) * 0.06;
  }

  // Edge attraction
  for (var e = 0; e < graphEdges.length; e++) {
    var edge = graphEdges[e];
    var si = edge.source, ti = edge.target;
    var sn = nodes[si], tn = nodes[ti];
    var dx = tn.x - sn.x;
    var dy = tn.y - sn.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    var rest = sn.r + tn.r + 30 + edge.weight * 8;
    var force = (dist - rest) * 0.0015 * (edge.weight / 3);
    var fx = (dx / dist) * force;
    var fy = (dy / dist) * force;
    if (!sn.fixed) { sn.vx += fx; sn.vy += fy; }
    if (!tn.fixed) { tn.vx -= fx; tn.vy -= fy; }
  }

  // Apply velocity
  for (var i = 0; i < n; i++) {
    var node = nodes[i];
    if (node.fixed) continue;
    node.vx *= 0.90;
    node.vy *= 0.90;
    var speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    if (speed > 4) { node.vx *= 4 / speed; node.vy *= 4 / speed; }
    node.x += node.vx;
    node.y += node.vy;
    node.x = Math.max(node.r, Math.min(w - node.r, node.x));
    node.y = Math.max(node.r, Math.min(h - node.r, node.y));
  }
}

function renderGraph() {
  var world = document.getElementById('graphWorld');
  if (!world || graphNodes.length === 0) return;

  var hueBase = 210;
  var hi = graphHoverIdx;
  var parts = [];

  // Edges first (behind nodes)
  for (var i = 0; i < graphEdges.length; i++) {
    var e = graphEdges[i];
    var s = graphNodes[e.source], t = graphNodes[e.target];
    var edgeCls = '';
    if (hi >= 0 && e.source !== hi && e.target !== hi) edgeCls = ' class="graph-edge dimmed"';
    var alpha = Math.min(0.5, e.weight / 20);
    parts.push('<line' + edgeCls + ' x1="' + s.x.toFixed(1) + '" y1="' + s.y.toFixed(1) +
      '" x2="' + t.x.toFixed(1) + '" y2="' + t.y.toFixed(1) +
      '" stroke="var(--color-outline)" stroke-width="' + Math.max(0.5, e.weight / 5).toFixed(1) +
      '" opacity="' + alpha.toFixed(2) + '"/>');
  }

  // Nodes
  for (var i = 0; i < graphNodes.length; i++) {
    var node = graphNodes[i];
    var hue = (hueBase + i * 29) % 360;
    var fs = node.fontSize || 11;
    var nodeCls = 'graph-node';
    if (hi >= 0) {
      if (i === hi) nodeCls += ' highlighted';
      else if (graphAdj[hi] && graphAdj[hi][i]) nodeCls += ' connected';
      else nodeCls += ' dimmed';
    }
    parts.push('<g class="' + nodeCls + '" data-node="' + i + '" data-action="graphNodeClick" data-value="' + escHtml(node.id) + '">' +
      '<circle cx="' + node.x.toFixed(1) + '" cy="' + node.y.toFixed(1) + '" r="' + node.r.toFixed(1) +
      '" fill="hsl(' + hue + ', 50%, 62%)" fill-opacity="0.75"/>' +
      '<text x="' + node.x.toFixed(1) + '" y="' + (node.y + fs * 0.35).toFixed(1) +
      '" text-anchor="middle" font-size="' + fs.toFixed(0) +
      '" fill="var(--color-on-surface)" font-weight="500">' + escHtml(node.id) + '</text>' +
      '</g>');
  }

  world.setAttribute('transform', 'translate(' + graphPanX.toFixed(1) + ',' + graphPanY.toFixed(1) + ') scale(' + graphZoom.toFixed(3) + ')');
  world.innerHTML = parts.join('');
}

function toggleView(view) {
  var listView = document.getElementById('listView');
  var graphView = document.getElementById('graphView');
  var filterBar = document.querySelector('.filter-bar');
  var docFooter = document.getElementById('docFooter');
  var listBtns = document.querySelectorAll('.header-tools .view-btn');

  if (view === 'graph') {
    if (listView) listView.hidden = true;
    if (filterBar) filterBar.hidden = true;
    if (docFooter) docFooter.hidden = true;
    if (graphView) graphView.hidden = false;
    listBtns.forEach(function(b) { b.classList.toggle('active', b.dataset.value === 'graph'); });
    document.body.classList.add('graph-active');
    initGraph();
    startGraph();
  } else {
    if (graphView) graphView.hidden = true;
    if (listView) listView.hidden = false;
    if (filterBar) filterBar.hidden = false;
    if (docFooter) docFooter.hidden = false;
    listBtns.forEach(function(b) { b.classList.toggle('active', b.dataset.value === 'list'); });
    document.body.classList.remove('graph-active');
    stopGraph();
    clearGraphPanel();
  }
}

// ═══════════════════════════════════════════════════════════════════
// Graph left panel — show sources for clicked tag
// ═══════════════════════════════════════════════════════════════════

function showGraphPanel(tag) {
  var panel = document.getElementById('graphPanel');
  var title = document.getElementById('graphPanelTitle');
  var list = document.getElementById('graphPanelList');
  if (!panel || !title || !list) return;
  panel.classList.remove('collapsed');

  var rows = document.querySelectorAll('#listView .row');
  var matches = [];
  rows.forEach(function(r) {
    var text = (r.dataset.text || '').toLowerCase();
    var tagLower = tag.toLowerCase();
    var re = new RegExp('(^|\\s)' + tagLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)', 'i');
    if (re.test(text)) {
      var nameEl = r.querySelector('.src-name');
      var urlEl = r.querySelector('.src-url');
      var favEl = r.querySelector('.favicon');
      var domainEl = r.querySelector('.domain-badge');
      var descEl = r.querySelector('.src-desc');
      matches.push({
        title: (nameEl ? nameEl.textContent : '').trim(),
        url: urlEl ? urlEl.getAttribute('href') || '' : '',
        displayUrl: urlEl ? urlEl.textContent.trim() : '',
        favicon: favEl ? favEl.getAttribute('src') || '' : '',
        domain: domainEl ? domainEl.textContent.trim() : '',
        desc: descEl ? descEl.textContent.trim() : '',
        tier: r.dataset.tier || '',
        type: r.dataset.type || ''
      });
    }
  });

  title.textContent = escHtml(tag) + ' · ' + matches.length;

  if (matches.length === 0) {
    list.innerHTML = '<div class="graph-panel-empty">无匹配源</div>';
  } else {
    var show = matches.slice(0, 30);
    list.innerHTML = show.map(function(m) {
      var tierCls = m.tier === 'S' ? 's' : (m.tier === 'A' ? 'a' : 'x');
      return '<a class="graph-panel-item" href="' + escHtml(m.url) + '" target="_blank" rel="noopener">' +
        '<div class="graph-panel-item-row1">' +
        '<span class="tier-badge tier-' + tierCls + '">' + escHtml(m.tier) + '</span>' +
        (m.favicon ? '<img class="favicon" src="' + escHtml(m.favicon) + '" width="16" height="16" loading="lazy">' : '') +
        '<span class="graph-panel-item-title">' + escHtml(m.title) + '</span>' +
        '</div>' +
        '<div class="graph-panel-item-row2">' +
        '<span class="graph-panel-item-url">' + escHtml(m.displayUrl) + '</span>' +
        (m.domain ? '<span class="graph-panel-item-domain">' + escHtml(m.domain) + '</span>' : '') +
        '<span class="graph-panel-item-type">' + escHtml(m.type) + '</span>' +
        '</div>' +
        (m.desc ? '<div class="graph-panel-item-desc">' + escHtml(m.desc) + '</div>' : '') +
        '</a>';
    }).join('');
    if (matches.length > 30) {
      list.innerHTML += '<div class="graph-panel-empty">还有 ' + (matches.length - 30) + ' 个源未显示</div>';
    }
  }
}

function clearGraphPanel() {
  var panel = document.getElementById('graphPanel');
  var title = document.getElementById('graphPanelTitle');
  var list = document.getElementById('graphPanelList');
  if (panel) panel.classList.add('collapsed');
  if (title) title.textContent = '标签节点';
  if (list) list.innerHTML = '<div class="graph-panel-hint">点击图谱中的标签查看相关源</div>';
}

// ═══════════════════════════════════════════════════════════════════
// Graph node click handler (in action delegation below)
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// Bootstrap
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  // Set initial count display
  var el = document.getElementById('countDisplay');
  if (el) el.textContent = totalCount + ' / ' + totalCount;

  // Capture original server order for heat toggle
  var rows = document.querySelectorAll('#listBody .row');
  for (var i = 0; i < rows.length; i++) { rows[i].dataset.origOrder = i; }

  fetchHealth();
  setupClickTracking();
  setupActionDelegation();

  // `/` keybinding — focus search input
  document.addEventListener('keydown', function(e) {
    if (e.key === '/' && document.activeElement !== document.getElementById('searchInput')) {
      e.preventDefault();
      var si = document.getElementById('searchInput');
      if (si) { si.focus(); si.select(); }
    }
    if (e.key === 'Escape') {
      var si = document.getElementById('searchInput');
      if (si && document.activeElement === si) { si.blur(); }
    }
  });

  // Graph: panel resize handle
  (function() {
    var handle = document.getElementById('graphResizeHandle');
    var panel = document.getElementById('graphPanel');
    if (!handle || !panel) return;
    var resizing = false;
    handle.addEventListener('mousedown', function(e) {
      resizing = true;
      handle.classList.add('active');
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!resizing) return;
      var rect = document.getElementById('graphView').getBoundingClientRect();
      var w = e.clientX - rect.left;
      if (w < 280) w = 280;
      if (w > rect.width * 0.85) w = rect.width * 0.85;
      panel.style.width = w + 'px';
    });
    document.addEventListener('mouseup', function() {
      if (resizing) handle.classList.remove('active');
      resizing = false;
    });
  })();

  // Graph: hover highlight
  (function() {
    var svg = document.getElementById('graphSvg');
    if (!svg) return;
    svg.addEventListener('mouseover', function(e) {
      var g = e.target.closest('.graph-node');
      if (!g) { graphHoverIdx = -1; return; }
      graphHoverIdx = parseInt(g.dataset.node, 10);
    });
    svg.addEventListener('mouseout', function(e) {
      if (e.target.closest('.graph-node')) graphHoverIdx = -1;
    });
  })();

  // Graph: zoom, pan, node drag
  (function() {
    var svg = document.getElementById('graphSvg');
    if (!svg) return;

    function svgToWorld(clientX, clientY) {
      var rect = svg.getBoundingClientRect();
      var sx = 800 / rect.width;
      var sy = 600 / rect.height;
      return {
        x: (clientX - rect.left) * sx / graphZoom - graphPanX / graphZoom,
        y: (clientY - rect.top) * sy / graphZoom - graphPanY / graphZoom
      };
    }

    // Wheel zoom
    svg.addEventListener('wheel', function(e) {
      e.preventDefault();
      var before = svgToWorld(e.clientX, e.clientY);
      graphZoom = Math.min(3, Math.max(0.3, graphZoom * (e.deltaY < 0 ? 1.1 : 0.9)));
      var after = svgToWorld(e.clientX, e.clientY);
      graphPanX += (after.x - before.x) * graphZoom;
      graphPanY += (after.y - before.y) * graphZoom;
      renderGraph();
    }, { passive: false });

    // Background pan (mousedown on empty SVG area)
    var panning = null;
    var clickInfo = null; // captured on mousedown, used if no drag
    svg.addEventListener('mousedown', function(e) {
      if (e.target.closest('.graph-node')) {
        // Node drag (or click)
        var g = e.target.closest('.graph-node');
        var idx = parseInt(g.dataset.node, 10);
        if (isNaN(idx) || idx < 0 || idx >= graphNodes.length) return;
        clickInfo = { action: g.dataset.action, value: g.dataset.value, sx: e.clientX, sy: e.clientY };
        e.preventDefault();
        var wp = svgToWorld(e.clientX, e.clientY);
        graphDrag = { node: graphNodes[idx], ox: wp.x - graphNodes[idx].x, oy: wp.y - graphNodes[idx].y };
        graphNodes[idx].fixed = true;
      } else {
        // Background pan
        clickInfo = null;
        panning = { sx: e.clientX, sy: e.clientY, px: graphPanX, py: graphPanY };
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', function(e) {
      if (panning) {
        graphPanX = panning.px + (e.clientX - panning.sx);
        graphPanY = panning.py + (e.clientY - panning.sy);
        renderGraph();
        return;
      }
      if (!graphDrag) return;
      graphDrag.lastX = e.clientX; graphDrag.lastY = e.clientY;
      var wp = svgToWorld(e.clientX, e.clientY);
      graphDrag.node.x = wp.x - graphDrag.ox;
      graphDrag.node.y = wp.y - graphDrag.oy;
      graphDrag.node.vx = 0; graphDrag.node.vy = 0;
      renderGraph();
    });

    document.addEventListener('mouseup', function() {
      // Detect click (no significant drag)
      if (clickInfo && graphDrag && graphDrag.node) {
        var dx = clickInfo.sx - (graphDrag.lastX || clickInfo.sx);
        var dy = clickInfo.sy - (graphDrag.lastY || clickInfo.sy);
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          if (clickInfo.action === 'graphNodeClick') showGraphPanel(clickInfo.value);
        }
      }
      if (graphDrag && graphDrag.node) graphDrag.node.fixed = false;
      graphDrag = null;
      panning = null;
      clickInfo = null;
    });

    // Touch: pinch zoom + pan + node drag
    var lastDist = 0;
    svg.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        panning = null;
        return;
      }
      if (e.touches.length === 1) {
        var g = e.target.closest('.graph-node');
        if (g) {
          var idx = parseInt(g.dataset.node, 10);
          if (isNaN(idx) || idx < 0 || idx >= graphNodes.length) return;
          clickInfo = { action: g.dataset.action, value: g.dataset.value, sx: e.touches[0].clientX, sy: e.touches[0].clientY };
          e.preventDefault();
          var wp = svgToWorld(e.touches[0].clientX, e.touches[0].clientY);
          graphDrag = { node: graphNodes[idx], ox: wp.x - graphNodes[idx].x, oy: wp.y - graphNodes[idx].y };
          graphNodes[idx].fixed = true;
        } else {
          panning = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, px: graphPanX, py: graphPanY };
        }
      }
    }, { passive: false });

    document.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (lastDist > 0) graphZoom = Math.min(3, Math.max(0.3, graphZoom * (d / lastDist)));
        lastDist = d;
        renderGraph();
        return;
      }
      if (panning) {
        graphPanX = panning.px + (e.touches[0].clientX - panning.sx);
        graphPanY = panning.py + (e.touches[0].clientY - panning.sy);
        renderGraph();
        return;
      }
      if (!graphDrag || e.touches.length !== 1) return;
      graphDrag.lastX = e.touches[0].clientX; graphDrag.lastY = e.touches[0].clientY;
      var wp = svgToWorld(e.touches[0].clientX, e.touches[0].clientY);
      graphDrag.node.x = wp.x - graphDrag.ox;
      graphDrag.node.y = wp.y - graphDrag.oy;
      graphDrag.node.vx = 0; graphDrag.node.vy = 0;
      renderGraph();
    }, { passive: false });

    document.addEventListener('touchend', function() {
      if (clickInfo && graphDrag && graphDrag.node) {
        var dx = clickInfo.sx - (graphDrag.lastX || clickInfo.sx);
        var dy = clickInfo.sy - (graphDrag.lastY || clickInfo.sy);
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          if (clickInfo.action === 'graphNodeClick') showGraphPanel(clickInfo.value);
        }
      }
      if (graphDrag && graphDrag.node) graphDrag.node.fixed = false;
      graphDrag = null;
      panning = null;
      clickInfo = null;
      lastDist = 0;
    });
  })();

  // Back to top visibility
  var btn = document.getElementById('backToTop');
  if (btn) {
    window.addEventListener('scroll', function() {
      btn.classList.toggle('visible', window.scrollY > 400);
    });
  }
});
