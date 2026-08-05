/**
 * 过滤逻辑自动化测试
 *
 * 测什么: 档位/域名/类型筛选 + 芯片数量 + 交叉过滤
 * 怎么测: 构造 Mock 数据 → 模拟服务端渲染 → 测试过滤匹配逻辑
 *
 * Usage: node _review/filter-test.js
 */
'use strict';

const { normalizeDomains, PRIMARY_ORDER, SECONDARY_REGISTRY, isValidPrimary } = require('../domain-registry.js');

// ════════════════════════════════════════════════════
// Mock 数据: 10 个源, 用旧标签(跟 Obsidian 文件一致)
// OLD_TO_NEW: AI→AI, 设计→设计, 电商→电商, 工具/开发/前端→开发工具,
//             产品→商业, 社区/媒体→内容平台, 学习/写作/参考/搜索→知识库
// ════════════════════════════════════════════════════
const MOCK_SOURCES = [
  // S 档: 2 个 AI 源
  { file:'ai-s1.md', title:'AI Alpha', url:'https://a.ai', tier:'S', source_type:'权威源', domains:['AI','LLM'], tags:['模型'] },
  { file:'ai-s2.md', title:'AI Beta',  url:'https://b.ai', tier:'S', source_type:'聚合源', domains:['AI','Agent'], tags:['工具'] },
  // A 档: 3 个设计源(旧标签: 设计/建筑/室内设计/家居生活→设计)
  { file:'design-a1.md', title:'设计A', url:'https://d1.design', tier:'A', source_type:'权威源', domains:['设计','设计灵感'], tags:['灵感'] },
  { file:'design-a2.md', title:'设计B', url:'https://d2.design', tier:'A', source_type:'平台',    domains:['室内设计','UI/UX'], tags:['UI'] },
  { file:'design-a3.md', title:'设计C', url:'https://d3.design', tier:'A', source_type:'权威源', domains:['家居生活','设计素材'], tags:['素材'] },
  // A 档: 1 电商(旧: 电商→电商) + 1 商业(旧: 产品→商业)
  { file:'ecom-a1.md',  title:'电商A', url:'https://e1.shop',   tier:'A', source_type:'平台',    domains:['电商','跨境电商'], tags:['跨境'] },
  { file:'biz-a1.md',   title:'商业A', url:'https://b1.biz',    tier:'A', source_type:'聚合源', domains:['产品','广告平台'], tags:['投放'] },
  // X 档: 2 AI(旧: AI→AI) + 1 开发工具(旧: 工具→开发工具)
  { file:'ai-x1.md',    title:'AI Spam',  url:'https://x1.ai',  tier:'X', source_type:'AI原生',  domains:['AI','视频生成'], tags:['视频'] },
  { file:'ai-x2.md',    title:'AI Junk',  url:'https://x2.ai',  tier:'X', source_type:'聚合源',  domains:['AI','资讯'], tags:['资讯'] },
  { file:'dev-x1.md',   title:'Dev Spam', url:'https://x3.dev', tier:'X', source_type:'工具',    domains:['工具','自动化'], tags:['爬虫'] },
];

// ════════════════════════════════════════════════════
// 规范化
// ════════════════════════════════════════════════════
const sources = MOCK_SOURCES.map(function(s) {
  var nd = normalizeDomains(s.domains, s.title, s.url);
  s._primary = nd.primary;
  s._secondary = nd.secondary;
  s._crossTags = nd.crossTags;
  return s;
});

// ════════════════════════════════════════════════════
// 模拟行渲染: 构建 data-tier / data-domain / data-type
// ════════════════════════════════════════════════════
function buildRow(s) {
  var domainsArr = [s._primary];
  if (s._secondary && s._secondary !== '未细分') domainsArr.push(s._secondary);
  if (s._crossTags) domainsArr.push.apply(domainsArr, s._crossTags);
  return {
    tier: s.tier || '',
    domain: domainsArr.join(' '),
    type: s.source_type || '',
    text: [s.title, s.url, (s.tags||[]).join(' '), domainsArr.join(' ')].join(' ').toLowerCase(),
    _source: s,
  };
}

const rows = sources.map(buildRow);

// ════════════════════════════════════════════════════
// 模拟客户端 JS applyFilters() 逻辑
// ════════════════════════════════════════════════════
function applyFilters(tier, domain, stype, search) {
  return rows.filter(function(r) {
    if (tier && tier !== 'all' && r.tier !== tier) return false;
    if (domain && domain !== 'all' && !r.domain.split(' ').includes(domain)) return false;
    if (stype && stype !== 'all' && r.type !== stype) return false;
    if (search && r.text.indexOf(search.toLowerCase()) === -1) return false;
    return true;
  });
}

// ════════════════════════════════════════════════════
// 计数工具
// ════════════════════════════════════════════════════
function countBy(list, key) {
  var acc = {};
  list.forEach(function(item) { acc[item[key]] = (acc[item[key]] || 0) + 1; });
  return acc;
}

// ════════════════════════════════════════════════════
// 断言
// ════════════════════════════════════════════════════
var passed = 0, failed = 0;

function assert(label, condition, detail) {
  if (condition) { passed++; }
  else {
    failed++;
    console.log('  FAIL [' + label + '] ' + (detail || ''));
  }
}

function hdr(msg) { console.log('\n' + msg); }

// ════════════════════════════════════════════════════
// Test Suite
// ════════════════════════════════════════════════════

console.log('══════════════════════════════════════════');
console.log(' 过滤逻辑测试 · ' + sources.length + ' mock 源');
console.log('══════════════════════════════════════════');

// ── §1 全局统计 ──
hdr('§1 全局统计');

var globalTierCounts = countBy(sources, 'tier');
var globalPrimaryCounts = {};
sources.forEach(function(s) { globalPrimaryCounts[s._primary] = (globalPrimaryCounts[s._primary] || 0) + 1; });
var globalTypeCounts = countBy(sources, 'source_type');

console.log('  档位: S=' + (globalTierCounts.S||0) + ' A=' + (globalTierCounts.A||0) + ' X=' + (globalTierCounts.X||0));
console.log('  一级: ' + JSON.stringify(globalPrimaryCounts));
console.log('  类型: ' + JSON.stringify(globalTypeCounts));

assert('S 档 2 源', globalTierCounts.S === 2);
assert('A 档 5 源', globalTierCounts.A === 5);
assert('X 档 3 源', globalTierCounts.X === 3);
assert('总源 10', sources.length === 10);
assert('AI 主域 4 源', globalPrimaryCounts.AI === 4);
assert('设计主域 3 源', globalPrimaryCounts['设计'] === 3);
assert('开发工具主域 1 源', globalPrimaryCounts['开发工具'] === 1);
assert('商业主域 1 源', globalPrimaryCounts['商业'] === 1);

// ── §2 无筛选（全部） ──
hdr('§2 无筛选: tier=all domain=all stype=all');

var all = applyFilters('all', 'all', 'all', '');
assert('无筛选返回全部 10 源', all.length === 10);

// 档位芯片应显示全局数量
var allTierCounts = countBy(all, 'tier');
assert('all -> S 计数=2', allTierCounts.S === 2);
assert('all -> A 计数=5', allTierCounts.A === 5);
assert('all -> X 计数=3', allTierCounts.X === 3);

// ── §3 单条件筛选 ──
hdr('§3 单条件筛选');

// 3.1 档位
var tierS = applyFilters('S', 'all', 'all', '');
assert('tier=S -> 2 行', tierS.length === 2);
assert('tier=S 全部是 S 档', tierS.every(function(r) { return r.tier === 'S'; }));

var tierX = applyFilters('X', 'all', 'all', '');
assert('tier=X -> 3 行', tierX.length === 3);
assert('tier=X 全部是 X 档', tierX.every(function(r) { return r.tier === 'X'; }));

// 3.2 域名
var domainAI = applyFilters('all', 'AI', 'all', '');
assert('domain=AI -> 4 行', domainAI.length === 4);
assert('domain=AI 全部含 AI', domainAI.every(function(r) { return r.domain.split(' ').includes('AI'); }));

var domainDesign = applyFilters('all', '设计', 'all', '');
assert('domain=设计 -> 3 行', domainDesign.length === 3);

// 3.3 类型
var typeAuth = applyFilters('all', 'all', '权威源', '');
assert('type=权威源 -> 3 行', typeAuth.length === 3);
assert('全部是权威源', typeAuth.every(function(r) { return r.type === '权威源'; }));

// ── §4 交叉筛选 (AND 逻辑) ──
hdr('§4 交叉筛选');

// 4.1 tier=S AND domain=AI
var s_ai = applyFilters('S', 'AI', 'all', '');
assert('S ∩ AI -> 2 行', s_ai.length === 2);

// 4.2 tier=X AND domain=开发工具
var x_dev = applyFilters('X', '开发工具', 'all', '');
assert('X ∩ 开发工具 -> 1 行', x_dev.length === 1);
assert('X ∩ 开发工具 = dev-x1', x_dev[0]._source.file === 'dev-x1.md');

// 4.3 tier=A AND domain=设计 AND type=权威源
var a_design_auth = applyFilters('A', '设计', '权威源', '');
assert('A ∩ 设计 ∩ 权威源 -> 2 行', a_design_auth.length === 2);
assert('行名正确', a_design_auth.every(function(r) { return ['design-a1.md','design-a3.md'].includes(r._source.file); }));

// 4.4 tier=S AND type=聚合源
var s_agg = applyFilters('S', 'all', '聚合源', '');
assert('S ∩ 聚合源 -> 1 行', s_agg.length === 1);

// 4.5 文本搜索
var search_kua = applyFilters('all', 'all', 'all', '跨境');
assert('search=跨境 -> 1 行', search_kua.length === 1);
assert('搜到电商A', search_kua[0]._source.file === 'ecom-a1.md');

// 4.6 tier=X AND search=视频
var x_video = applyFilters('X', 'all', 'all', '视频');
assert('X ∩ search=视频 -> 1 行', x_video.length === 1);

// ── §5 芯片数量验证 ──
hdr('§5 芯片数量验证');

// 5.1 档位芯片: 始终显示全局总数（不在 applyFilters 中更新）
console.log('  档位芯片全局: S=' + globalTierCounts.S + ' A=' + globalTierCounts.A + ' X=' + globalTierCounts.X);
assert('档位全局 S=2', globalTierCounts.S === 2);
assert('档位全局 A=5', globalTierCounts.A === 5);
assert('档位全局 X=3', globalTierCounts.X === 3);

// 5.2 域名芯片: 始终显示全局总数
console.log('  域名芯片全局: AI=' + globalPrimaryCounts.AI + ' 设计=' + globalPrimaryCounts['设计'] + ' 电商=' + globalPrimaryCounts['电商']);
assert('域名全局 AI=4', globalPrimaryCounts.AI === 4);
assert('域名全局 设计=3', globalPrimaryCounts['设计'] === 3);
assert('域名全局 电商=1', globalPrimaryCounts['电商'] === 1);

// 5.3 域名芯片：随筛选动态更新（帮助用户在筛选后看到各域可用量）
var xDomainCounts = {};
tierX.forEach(function(r) { var p = r._source._primary; xDomainCounts[p] = (xDomainCounts[p] || 0) + 1; });
console.log('  X 档实际域分布: ' + JSON.stringify(xDomainCounts));
// X 档: AI=2, 开发工具=1 — 域名芯片应显示过滤后数量
assert('X 档下 AI 域=2', xDomainCounts.AI === 2);
assert('X 档下 开发工具 域=1', xDomainCounts['开发工具'] === 1);
assert('X 档下 设计域未出现', !xDomainCounts['设计']);

// ── §6 边界情况 ──
hdr('§6 边界');

// 6.1 不存在的筛选值
var noMatch = applyFilters('S', '电商', 'all', '');
assert('S ∩ 电商 -> 0 行（无交集）', noMatch.length === 0);

// 6.2 空搜索
var emptySearch = applyFilters('all', 'all', 'all', '');
assert('空搜索=全部 10', emptySearch.length === 10);

// 6.3 所有筛选同时设
var allFilters = applyFilters('A', '设计', '权威源', '');
assert('A ∩ 设计 ∩ 权威源 -> 2 行', allFilters.length === 2);

// 6.4 search 需匹配 text（title + url + tags + domains）
var searchUrl = applyFilters('all', 'all', 'all', 'x3.dev');
assert('search url -> 1 行', searchUrl.length === 1);

// 6.5 domain 匹配跨组标签
// ai-x2: domains=['AI','资讯'], _primary=AI, _secondary=资讯
// row.domain = "AI 资讯", filter domain='资讯' 应匹配
var secDomain = applyFilters('all', '资讯', 'all', '');
assert('二级域名 资讯 匹配', secDomain.length === 1);
assert('二级域名 资讯 -> ai-x2', secDomain[0]._source.file === 'ai-x2.md');

// 6.6 crossTags 应该可筛选
// prod source: tier=S AI+开发工具
// row.domain = "AI Agent 开发工具" (for ai-s2 with crossTags)
// Actually in mock data, ai-s2 has domains:['AI','Agent'], Agent is secondary, no crossTags
// Let me check the actual row output
hdr('§6.6 行数据快照');
rows.forEach(function(r) {
  console.log('  ' + r._source.file + ' tier=' + r.tier + ' domain="' + r.domain + '" type=' + r.type);
});

// 6.7 验证所有行的 domain 包含 _primary
var allRowsHavePrimary = rows.every(function(r) {
  return r.domain.split(' ').includes(r._source._primary);
});
assert('所有行 domain 包含 _primary', allRowsHavePrimary);

// ── §7 服务端渲染验证（HTML 结构） ──
hdr('§7 服务端渲染属性');
rows.forEach(function(r) {
  var s = r._source;
  assert(s.file + ' tier 非空', r.tier.length > 0);
  assert(s.file + ' domain 非空', r.domain.length > 0);
  assert(s.file + ' type 非空', r.type.length > 0);
  assert(s.file + ' domain 含主域', r.domain.indexOf(s._primary) >= 0);
});

// ── §8 新分类体系 round-trip（§2 修复验证） ──
hdr('§8 新一级标签恒等映射');

var newLabels = ['开发工具', '内容平台', '商业', '知识库'];
newLabels.forEach(function(label) {
  var nd = normalizeDomains([label], '测试源', 'https://test.com');
  assert('新标签 "' + label + '" 映射为自身', nd.primary === label);
});

// 新旧混用: '开发' (旧→开发工具) + '开发工具' (新→开发工具) — 应正确去重
var mixNd = normalizeDomains(['开发', '开发工具'], '混用源', 'https://mix.com');
assert('新旧混用去重: primary=开发工具', mixNd.primary === '开发工具');
assert('新旧混用去重: 1 个 candidate (去重)', mixNd.crossTags.length === 0);

// ── §9 空 domains 不默认知识库（§3 修复验证） ──
hdr('§9 空 domains 返回 null');

var emptyNd = normalizeDomains([], '空源', 'https://empty.com');
assert('空数组 primary=null', emptyNd.primary === null);

var nullNd = normalizeDomains(null, '空源', 'https://empty.com');
assert('null 参数 primary=null', nullNd.primary === null);

// ── §10 IP管理 不再强制覆盖（§4 修复验证） ──
hdr('§10 IP管理 回归开发工具');

var ipNd = normalizeDomains(['工具', 'IP管理'], 'IPRoyal', 'https://dashboard.iproyal.com');
assert('IPRoyal primary=开发工具 (非商业)', ipNd.primary === '开发工具');

// 招聘网站仍应生效
var recruitNd = normalizeDomains(['招聘网站'], '某招聘', 'https://zhaopin.com');
assert('招聘网站 primary=商业 (覆盖生效)', recruitNd.primary === '商业');

// ── §11 crossTags 应计入芯片计数（§6 修复验证） ──
hdr('§11 crossTags 计入域名筛选计数');

// Simulate server.js domainCounts logic (now includes crossTags)
var domainCounts = {};
sources.forEach(function(s) {
  var p = s._primary;
  if (p) domainCounts[p] = (domainCounts[p] || 0) + 1;
  var tags = s._crossTags || [];
  tags.forEach(function(t) { domainCounts[t] = (domainCounts[t] || 0) + 1; });
});

// Verify: applying a domain filter should match the same count as the chip shows
var DOMAINS_TO_CHECK = ['AI', '设计', '电商', '开发工具', '内容平台', '商业', '知识库'];
DOMAINS_TO_CHECK.forEach(function(d) {
  var chipCount = domainCounts[d] || 0;
  var filterCount = applyFilters('all', d, 'all', '').length;
  var ok = chipCount === filterCount;
  if (!ok) console.log('  MISMATCH: ' + d + ' chip=' + chipCount + ' filter=' + filterCount);
  assert(d + ' 芯片数字=' + filterCount + ' (过滤结果数)', ok);
});

// ── §12 PRIMARY_HINT_SECONDARY 推断 ──
hdr('§12 旧一级标签推断二级');

// 设计类: 建筑/室内设计/家居生活/景观 → 各自二级
var hintTests = [
  { domains: ['建筑', '设计'], expected: '建筑与景观', desc: '建筑→建筑与景观' },
  { domains: ['室内设计', '家居生活'], expected: '室内与家居', desc: '室内设计→室内与家居' },
  { domains: ['景观', '设计'], expected: '建筑与景观', desc: '景观→建筑与景观' },
  { domains: ['前端', 'UI组件'], expected: 'UI/UX', desc: '前端→UI/UX' },
  { domains: ['开发', '技术问答'], expected: '技术社区', desc: '开发+技术问答→技术社区' },
  { domains: ['AI', '代码'], expected: '代码托管', desc: '代码(AI primary)→代码托管(registry命中)' },
  { domains: ['工具', '设计工具'], expected: '设计工具', desc: '工具→效率工具(不匹配)，设计工具直接命中' },
  { domains: ['AI', '社区'], expected: '社交平台', desc: '社区→社交平台' },
  { domains: ['媒体', '资讯'], expected: '资讯', desc: '媒体→资讯(内容平台)' },
  { domains: ['AI', '工具'], expected: '效率工具', desc: '工具→效率工具(AI primary)' },
  { domains: ['AI', 'API'], expected: 'API', desc: 'API(AI primary)→API' },
  { domains: ['搜索', 'AI'], expected: '通用搜索', desc: '搜索→通用搜索' },
  { domains: ['产品', 'AI'], expected: '变现', desc: '产品→变现' },
  { domains: ['写作', '博客'], expected: '教程课程', desc: '写作→教程课程' },
  { domains: ['学习', 'AI'], expected: '学习资源', desc: '学习→学习资源' },
  { domains: ['参考', '设计参考'], expected: '设计灵感', desc: '参考→设计灵感' },
  { domains: ['工具', 'IP管理'], expected: '云服务', desc: 'IP管理→云服务' },
  // 纯 hint 路径（无 legacySecondary 可用时从 legacyPrimary 推断）
  { domains: ['AI', '社区', '媒体'], expected: '社交平台', desc: '纯hint: AI+社区→社交平台(无legacySecondary)' },
];
hintTests.forEach(function(t) {
  var nd = normalizeDomains(t.domains, t.desc, 'https://test.com');
  assert(t.desc + ' secondary=' + t.expected, nd.secondary === t.expected);
});

// ── §13 二级全覆盖（除空 domains） ──
hdr('§13 所有 source 二级≠未细分');

sources.forEach(function(s) {
  var nd = normalizeDomains(s.domains, s.title, s.url);
  if (s.domains && s.domains.length > 0) {
    assert(s.file + ' 有二级标签', nd.secondary !== '未细分');
  }
});

// 空 domains → 未细分 是期望行为
var emptyNd2 = normalizeDomains([], '空', 'https://x.com');
assert('空 domains secondary=未细分', emptyNd2.secondary === '未细分');


console.log('\n══════════════════════════════════════════');
var total = passed + failed;
console.log(' ' + (failed === 0 ? 'PASS' : 'FAIL') + '  ' + passed + '/' + total + ' 通过');
if (failed > 0) console.log(' ' + failed + ' 项失败');
console.log('══════════════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);
