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
// Documentation footer toggle
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

  // Back to top visibility
  var btn = document.getElementById('backToTop');
  if (btn) {
    window.addEventListener('scroll', function() {
      btn.classList.toggle('visible', window.scrollY > 400);
    });
  }
});
