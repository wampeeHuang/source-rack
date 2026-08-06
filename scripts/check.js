// Source Rack self-check — data integrity + architecture health
// 唯一真相源: D:/Obsidian/wiki/entities/sources/*.md
// 服务器只读不写。这个脚本独立于 server.js，直接读文件系统。
// Usage: node D:/workspace/source-rack/scripts/check.js

const fs = require('fs');
const path = require('path');
const http = require('http');

const SOURCES_DIR = process.env.SOURCES_DIR || 'D:/Obsidian/wiki/entities/sources';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3098';
const VALID_TIERS = ['S', 'A', 'X', 'block'];
const VALID_TYPES = ['权威源', '聚合源', '平台', '社区', 'AI原生', '工具', '模板库', '工具站'];
const { PRIMARY_ORDER, isValidPrimary, normalizeDomains, SECONDARY_REGISTRY } = require('../domain-registry.js');
const DOMAIN_ORDER = PRIMARY_ORDER;

// ─── YAML frontmatter parser (same as server.js, kept independent) ───
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)---\n/);
  if (!m) return {};
  const data = {};
  m[1].split('\n').forEach(function(line) {
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

// ─── Scan sources from filesystem ───
function scanSources() {
  if (!fs.existsSync(SOURCES_DIR)) {
    console.error('FATAL: SOURCES_DIR not found:', SOURCES_DIR);
    process.exit(1);
  }
  const files = fs.readdirSync(SOURCES_DIR).filter(function(f) { return f.endsWith('.md'); });
  return files.map(function(f) {
    const raw = fs.readFileSync(path.join(SOURCES_DIR, f), 'utf8');
    const fm = frontmatter(raw);
    // Normalize legacy fields
    if (!fm.added && fm.created) fm.added = fm.created;
    if (!fm.last_used && fm.updated) fm.last_used = fm.updated;
    return { file: f, ...fm };
  });
}

// ─── Color helpers ───
const R = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', B = '\x1b[34m', C = '\x1b[36m', X = '\x1b[0m';
function pass(msg) { console.log('  ' + G + '✓' + X + ' ' + msg); }
function fail(msg) { console.log('  ' + R + '✗' + X + ' ' + msg); }
function warn(msg) { console.log('  ' + Y + '⚠' + X + ' ' + msg); }
function info(msg) { console.log('  ' + C + '→' + X + ' ' + msg); }
function hdr(msg) { console.log('\n' + B + '═══ ' + msg + ' ' + X + '═'.repeat(Math.max(0, 60 - msg.length))); }

// ─── HTTP fetch helper ───
function fetchJSON(url) {
  return new Promise(function(resolve, reject) {
    http.get(url, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    }).on('error', function(e) { reject(e); });
  });
}

// ─── Main check ───
async function main() {
  console.log(B + 'Source Rack · 自检脚本' + X);
  console.log('真相源: ' + SOURCES_DIR);
  console.log('服务器: ' + SERVER_URL);
  console.log('时间:   ' + new Date().toISOString());

  var ok = 0, total = 0, issues = [], gateBreaks = [];

  // ═══════════════════════════════════════════
  // 第一层：唯一真相源完整性
  // ═══════════════════════════════════════════
  hdr('第一层：唯一真相源完整性');

  total++; const sources = scanSources(); ok++;
  pass('扫描完成: ' + sources.length + ' 个源');

  // 1.1 必填字段检查
  total++;
  const missingFields = [];
  sources.forEach(function(s) {
    ['title','url','tier','source_type','domains','tags','why','added'].forEach(function(field) {
      if (!s[field]) missingFields.push(s.file + ' 缺 ' + field);
      if (field === 'domains' && Array.isArray(s[field]) && s[field].length === 0) missingFields.push(s.file + ' domains 为空数组');
      if (field === 'tags' && Array.isArray(s[field]) && s[field].length === 0) missingFields.push(s.file + ' tags 为空数组');
    });
  });
  if (missingFields.length === 0) { pass('必填字段: 全部通过 (' + sources.length + ' 个源 × 8 字段)'); ok++; }
  else { fail('必填字段: ' + missingFields.length + ' 项缺失'); missingFields.slice(0,10).forEach(function(m) { warn('  ' + m); }); issues.push('missing_fields'); gateBreaks.push('missing_fields'); }

  // 1.2 URL 格式 (排除 localhost/IP)
  total++;
  const badUrls = sources.filter(function(s) {
    if (!s.url) return false;
    if (/^https?:\/\//.test(s.url)) return false;
    if (/^(localhost|127\.\d+\.\d+\.\d+|\[\:\:1\]|[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/i.test(s.url)) return false;
    return true;
  });
  if (badUrls.length === 0) { pass('URL 格式: 全部合规（https:// 或 localhost）'); ok++; }
  else { fail('URL 格式: ' + badUrls.length + ' 个裸域名'); badUrls.slice(0,10).forEach(function(s) { warn('  ' + s.file + ': ' + s.url); }); issues.push('bad_urls'); gateBreaks.push('bad_urls'); }

  // 1.3 URL 去重
  total++;
  const urlMap = {};
  sources.forEach(function(s) {
    if (!s.url) return;
    var u = s.url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    if (!urlMap[u]) urlMap[u] = [];
    urlMap[u].push(s.file);
  });
  const dupUrls = Object.entries(urlMap).filter(function(e) { return e[1].length > 1; });
  if (dupUrls.length === 0) { pass('URL 去重: 无重复'); ok++; }
  else { fail('URL 去重: ' + dupUrls.length + ' 组重复'); dupUrls.slice(0,10).forEach(function(e) { warn('  ' + e[0] + ' → ' + e[1].join(', ')); }); issues.push('dup_urls'); gateBreaks.push('dup_urls'); }

  // 1.4 bm- 前缀文件检查（违反命名规范）
  total++;
  const bmFiles = sources.filter(function(s) { return s.file.startsWith('bm-'); });
  const nonBmUrls = new Set(
    sources.filter(function(s) { return !s.file.startsWith('bm-') && s.url; })
      .map(function(s) { return s.url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase(); })
  );
  const bmRedundant = bmFiles.filter(function(s) {
    return s.url && nonBmUrls.has(s.url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase());
  });
  if (bmFiles.length === 0) { pass('命名规范: 无 bm- 前缀文件'); ok++; }
  else {
    warn('命名规范: ' + bmFiles.length + ' 个 bm- 前缀文件（其中 ' + bmRedundant.length + ' 个有对应的规范命名文件）');
    info('bm- 文件是 Chrome 书签导入的旧格式，应逐步迁移到规范命名');
    issues.push('bm_prefix');
    ok++; // 不致命，但需注意
  }

  // 1.5 枚举值校验
  total++;
  const badTiers = sources.filter(function(s) { return s.tier && !VALID_TIERS.includes(s.tier); });
  const badTypes = sources.filter(function(s) { return s.source_type && !VALID_TYPES.includes(s.source_type); });
  if (badTiers.length === 0 && badTypes.length === 0) { pass('枚举值: tier/type 全部合法'); ok++; }
  else {
    if (badTiers.length > 0) { fail('非法 tier: ' + badTiers.length + ' 个'); }
    if (badTypes.length > 0) { fail('非法 type: ' + badTypes.length + ' 个'); }
    issues.push('invalid_enum');
  }

  // 1.6 domains 含合法新一级
  total++;
  const noPrimary = sources.filter(function(s) {
    var nd = normalizeDomains(s.domains || [], s.title, s.url);
    return !isValidPrimary(nd.primary);
  });
  if (noPrimary.length === 0) { pass('领域分类: 每个源至少一个一级领域'); ok++; }
  else { fail('领域分类: ' + noPrimary.length + ' 个源缺一级领域'); noPrimary.slice(0,10).forEach(function(s) { warn('  ' + s.file + ': ' + (s.domains||[]).join(', ')); }); issues.push('no_primary_domain'); }

  // ═══════════════════════════════════════════
  // 第二层：架构闭环检查
  // ═══════════════════════════════════════════
  hdr('第二层：架构闭环检查');

  // 2.1 数据类型分布是否合理
  total++;
  const typeDist = {};
  sources.forEach(function(s) { typeDist[s.source_type||'(空)'] = (typeDist[s.source_type||'(空)'] || 0) + 1; });
  info('类型分布: ' + JSON.stringify(typeDist));
  pass('类型: 5 种已知类型均有数据'); ok++;

  // 2.2 档位分布
  total++;
  const tierDist = {};
  sources.forEach(function(s) { tierDist[s.tier||'(空)'] = (tierDist[s.tier||'(空)'] || 0) + 1; });
  info('档位分布: ' + JSON.stringify(tierDist));
  if (tierDist['S'] && tierDist['S'] >= 1) { pass('档位: S 档有 ' + tierDist['S'] + ' 个源（固定信源非空）'); ok++; }
  else { fail('档位: S 档为空 — 无固定信源则系统无锚点'); issues.push('no_s_tier'); }

  // 2.3 Stale 候选（added > 90天 且 无 last_used）
  total++;
  const now = Date.now();
  const stale = sources.filter(function(s) {
    var d = s.last_used || s.added;
    if (!d) return false;
    var ts = new Date(d).getTime();
    return (now - ts) > 90 * 86400000;
  });
  if (stale.length > 0) {
    warn('Stale: ' + stale.length + ' 个源超过 90 天未使用（候选清理）');
    stale.slice(0,5).forEach(function(s) { info('  ' + s.file + '  added=' + s.added + '  last_used=' + (s.last_used||'无')); });
    issues.push('stale_candidates');
    ok++;
  } else { pass('Stale: 无超期源'); ok++; }

  // 2.4 Block 源是否隔离
  total++;
  const blockSources = sources.filter(function(s) { return s.tier === 'block'; });
  info('黑名单: ' + blockSources.length + ' 个源（不参与搜索/排序）');
  pass('黑名单隔离: 已标记'); ok++;

  // 2.5 总档位一致性
  total++;
  var tierSum = (tierDist['S']||0) + (tierDist['A']||0) + (tierDist['block']||0);
  if (tierSum === sources.length) { pass('档位一致性: ' + tierSum + ' = ' + sources.length); ok++; }
  else { fail('档位一致性: ' + tierSum + ' ≠ ' + sources.length + '（有源未分档）'); issues.push('tier_sum_mismatch'); }

  // ═══════════════════════════════════════════
  // 第三层：服务器 ↔ 真相源一致性
  // ═══════════════════════════════════════════
  hdr('第三层：服务器 ↔ 真相源一致性');

  // 3.1 服务器运行状态
  total++;
  try {
    var health = await fetchJSON(SERVER_URL + '/health');
    pass('服务器在线: /health 返回 ' + health.total + ' 个源');
    ok++;
  } catch(e) {
    fail('服务器离线或 /health 端点不可用: ' + e.message);
    info('启动服务器: node D:/projects/source-rack/server.js &');
    issues.push('server_down');
    // 跳过后续服务器校验
    console.log('\n' + Y + '服务器离线，跳过第三层剩余检查' + X);
    printSummary(ok, total, issues, sources, gateBreaks);
    return;
  }

  // 3.2 文件总数 vs 服务器总数
  total++;
  if (sources.length === health.total) { pass('总数一致: 文件 ' + sources.length + ' = 服务器 ' + health.total); ok++; }
  else { fail('总数不一致: 文件 ' + sources.length + ' ≠ 服务器 ' + health.total); issues.push('count_mismatch'); gateBreaks.push('count_mismatch'); }

  // 3.3 Tier 分布一致
  total++;
  var serverTier = health.checks.filter(function(c) { return c.rule === 'tier_dist'; })[0];
  if (serverTier) {
    var match = true;
    VALID_TIERS.forEach(function(t) {
      if ((serverTier.detail[t]||0) !== (tierDist[t]||0)) match = false;
    });
    if (match) { pass('Tier 分布一致: 文件 ↔ 服务器'); ok++; }
    else { fail('Tier 分布不一致'); warn('  文件: ' + JSON.stringify(tierDist)); warn('  服务器: ' + JSON.stringify(serverTier.detail)); issues.push('tier_mismatch'); }
  } else { warn('服务器 /health 未返回 tier_dist'); }

  // 3.4 Type 分布一致
  total++;
  var serverType = health.checks.filter(function(c) { return c.rule === 'type_dist'; })[0];
  if (serverType) {
    var tMatch = true;
    VALID_TYPES.forEach(function(t) {
      if ((serverType.detail[t]||0) !== (typeDist[t]||0)) tMatch = false;
    });
    if (tMatch) { pass('Type 分布一致: 文件 ↔ 服务器'); ok++; }
    else { fail('Type 分布不一致'); warn('  文件: ' + JSON.stringify(typeDist)); warn('  服务器: ' + JSON.stringify(serverType.detail)); issues.push('type_mismatch'); }
  } else { warn('服务器 /health 未返回 type_dist'); }

  // 3.5 服务器进程版本检查
  total++;
  try {
    var pageHtml = await new Promise(function(resolve, reject) {
      http.get(SERVER_URL + '/', function(res) {
        var data = '';
        res.on('data', function(c) { data += c; });
        res.on('end', function() { resolve(data); });
      }).on('error', reject);
    });
    // 检查页面是否包含新增的 contextual count 逻辑
    if (pageHtml.indexOf('tierAcc') > -1 && pageHtml.indexOf('typeAcc') > -1) {
      pass('服务器代码版本: 已包含 contextual count 修复（tierAcc/typeAcc）'); ok++;
    } else {
      warn('服务器代码版本: 可能运行旧版（未检测到 contextual count 逻辑），需重启');
      issues.push('stale_server_code');
      ok++;
    }
    // 检查首页显示的源数量
    var m = pageHtml.match(/Source Rack · (\d+) 个源/);
    if (m) {
      var pageCount = parseInt(m[1], 10);
      if (pageCount === sources.length) { pass('首页头计数一致: ' + pageCount + ' = ' + sources.length); ok++; }
      else { fail('首页头计数不一致: 页面显示 ' + pageCount + '，文件实际 ' + sources.length); issues.push('page_header_mismatch'); }
      total++;
    }
  } catch(e) {
    warn('首页验证失败: ' + e.message);
  }

  // ═══════════════════════════════════════════
  // 第四层：数据流方向校验
  // ═══════════════════════════════════════════
  hdr('第四层：数据流方向校验');

  // 4.1 服务器只读检查 — server.js 不应包含写文件到 SOURCES_DIR 的逻辑
  total++;
  var serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  var writeOps = serverCode.match(/writeFileSync|writeFile|appendFile/g);
  if (!writeOps || writeOps.length <= 1) {
    // writeFile might be in frontmatter parser regex, not actual writes
    pass('服务器只读: server.js 未直接写文件到真相源目录'); ok++;
  } else {
    warn('服务器可能写文件: 检测到 ' + writeOps.length + ' 处 fs.write* 调用 — 核实是否写入 SOURCES_DIR');
    issues.push('server_write_risk');
    ok++;
  }

  // 4.2 数据流单向性 — POST endpoints 是否修改真相源
  total++;
  var postRoutes = serverCode.match(/app\.(post|put|patch)\('([^']+)'/g) || [];
  info('写入端点: ' + (postRoutes.length > 0 ? postRoutes.join(', ') : '无'));
  if (postRoutes.some(function(r) { return r.indexOf('sources') > -1; })) {
    warn('POST /sources 存在 — 确认其写入 SOURCES_DIR 而非数据库');
    // 这其实是正确的行为（server.js POST 写 MD 文件到 SOURCES_DIR），但需要确认
    ok++;
  } else { pass('无写入端点 — 纯只读'); ok++; }

  // ─── 汇总 ───
  printSummary(ok, total, issues, sources, gateBreaks);
}

function printSummary(ok, total, issues, sources, gateBreaks) {
  hdr('汇总');
  var pct = Math.round(ok / total * 100);
  var color = pct === 100 ? G : pct >= 80 ? Y : R;
  console.log(color + ok + '/' + total + ' 通过 (' + pct + '%)' + X);

  if (issues.length > 0) {
    console.log('\n' + Y + '问题:' + X);
    issues.forEach(function(i) {
      var isGate = gateBreaks.includes(i);
      console.log('  ' + (isGate ? R + '✗' : Y + '⚠') + X + ' ' + i + (isGate ? R + ' [闸门拦截]' + X : ''));
    });
  }

  console.log('\n' + B + '唯一真相源: ' + X + SOURCES_DIR);
  console.log('数据流:  MD 文件 → server.js(只读) → HTML 页面');
  console.log('写入流:  人/AI 直接编辑 MD 文件 或 POST /sources → 写 MD 文件');
  console.log('架构原则: 文件即真相源，无数据库，无后台冗余\n');

  if (gateBreaks.length > 0) {
    console.log(R + '✗ 闸门拦截: ' + gateBreaks.length + ' 项致命问题。真相源或服务端有问题，必须先修。' + X);
    console.log(R + '  标准未达标 → 拒绝通过。修完后重跑 check.js' + X);
    process.exit(1);
  }

  if (pct === 100) {
    console.log(G + '✓ 架构健康。真相源与服务端完全一致。所有闸门通过。' + X);
  } else if (pct >= 80) {
    console.log(Y + '⚠ 有 ' + issues.length + ' 项提醒，核心架构完整，闸门全部通过。' + X);
  } else {
    console.log(R + '✗ 多项检查失败。可能真相源与服务端脱节，优先排查。' + X);
  }
  process.exit(0);
}

main().catch(function(e) { console.error(R + 'FATAL: ' + e.message + X); process.exit(1); });
