/**
 * Phase 0 Audit — 统计 594 源领域数据分布
 * 输出: 唯一源数、跨组源清单、乱码标签、二级分布、旧→新映射预览
 */
const fs = require('fs');
const path = require('path');

const SRCDIR = 'D:/Obsidian/wiki/entities/sources';

// ── 旧一级 → 新一级 映射表 ──────────────────────────────
const OLD_TO_NEW = {
  'AI': 'AI',
  '设计': '设计',
  '建筑': '设计',
  '室内设计': '设计',
  '家居生活': '设计',
  '景观': '设计',
  '电商': '电商',
  '工具': '开发工具',
  '开发': '开发工具',
  '前端': '开发工具',
  '产品': '商业',
  '写作': '知识库',
  '学习': '知识库',
  '社区': '内容平台',
  '媒体': '内容平台',
  '参考': '知识库',
  '搜索': '知识库',
};

const NEW_DOMAINS = ['AI', '设计', '电商', '开发工具', '内容平台', '商业', '知识库'];

// ── 从纯文本提取 YAML frontmatter domains 数组 ──────────
function extractDomains(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return [];
  const fm = m[1];
  const dm = fm.match(/^domains:\s*\[([^\]]*)\]/m);
  if (!dm) {
    // 尝试 YAML 多行列表格式
    const ml = fm.match(/^domains:\s*\n([\s\S]*?)^\w/m);
    if (ml) {
      const items = ml[1].match(/^\s*-\s*(.+)$/gm);
      if (items) return items.map(s => s.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
    }
    return [];
  }
  return dm[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

function extractField(text, field) {
  const m = text.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : '';
}

// ── 检测乱码/非 UTF-8 ──────────────────────────────────
function detectGarbled(text) {
  const issues = [];
  // U+FFFD replacement characters
  const fffd = (text.match(/�/g) || []).length;
  if (fffd > 0) issues.push(`FFFD x${fffd}`);
  // Common garbled patterns from GBK→UTF8 misread
  if (/[\x80-\x9F]{2,}/.test(text)) issues.push('C1 control bytes');
  // Check for mojibake patterns (e.g., æ instead of 图)
  if (/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞß]{3,}/.test(text)) issues.push('latin mojibake');
  return issues;
}

// ── 主统计 ──────────────────────────────────────────────
function audit() {
  const files = fs.readdirSync(SRCDIR).filter(f => f.endsWith('.md'));
  const results = [];
  const encodingIssues = [];
  const crossGroup = [];
  const oldDomainCounts = {};
  const newDomainCounts = {};
  const secondaryCounts = {};
  const allSecondaries = new Set();

  for (const fname of files) {
    const fpath = path.join(SRCDIR, fname);
    let raw;
    try {
      raw = fs.readFileSync(fpath, 'utf8');
    } catch (e) {
      // 尝试 latin1 回退
      const buf = fs.readFileSync(fpath);
      raw = buf.toString('utf8');
    }

    const encIssues = detectGarbled(raw);
    const domains = extractDomains(raw);
    const title = extractField(raw, 'title');
    const url = extractField(raw, 'url');

    // 分离旧一级和二级（启发式：在 OLD_TO_NEW 表里的是一级，否则是二级）
    const primaries = domains.filter(d => OLD_TO_NEW.hasOwnProperty(d));
    const secondaries = domains.filter(d => !OLD_TO_NEW.hasOwnProperty(d));

    // 映射到新一级
    const newPrimaries = [...new Set(primaries.map(d => OLD_TO_NEW[d]).filter(Boolean))];

    // 统计旧一级出现次数
    for (const d of primaries) {
      oldDomainCounts[d] = (oldDomainCounts[d] || 0) + 1;
    }

    // 统计二级
    for (const s of secondaries) {
      secondaryCounts[s] = (secondaryCounts[s] || 0) + 1;
      allSecondaries.add(s);
    }

    const entry = {
      file: fname,
      title,
      url,
      domains,
      oldPrimary: primaries,
      secondary: secondaries,
      newPrimary: newPrimaries,
      crossGroup: newPrimaries.length > 1,
      encodingIssues: encIssues,
    };

    results.push(entry);

    if (encIssues.length > 0) {
      encodingIssues.push(entry);
    }

    if (newPrimaries.length > 1) {
      crossGroup.push(entry);
    }

    // 统计新一级唯一源（取第一个新一级作为主归属）
    if (newPrimaries.length > 0) {
      const main = newPrimaries[0];
      newDomainCounts[main] = (newDomainCounts[main] || 0) + 1;
    }
  }

  // ── 输出报告 ──────────────────────────────────────────
  const out = [];

  out.push('='.repeat(70));
  out.push('Phase 0 Audit — 源数据分布统计');
  out.push(`扫描文件: ${results.length}`);
  out.push(`日期: ${new Date().toISOString().slice(0, 10)}`);
  out.push('='.repeat(70));

  // §1: 旧一级统计
  out.push('\n── §1 旧一级领域（标签出现次数 / 唯一源数）──');
  const oldUnique = {};
  for (const r of results) {
    for (const d of r.oldPrimary) {
      if (!oldUnique[d]) oldUnique[d] = new Set();
      oldUnique[d].add(r.file);
    }
  }
  const sorted = Object.keys(oldDomainCounts).sort((a, b) => oldDomainCounts[b] - oldDomainCounts[a]);
  for (const d of sorted) {
    const uniq = oldUnique[d] ? oldUnique[d].size : 0;
    out.push(`  ${d}: ${oldDomainCounts[d]} 次出现, ${uniq} 唯一源`);
  }

  // §2: 新一级统计
  out.push('\n── §2 新一级（按第一个新标签归属，唯一源）──');
  for (const nd of NEW_DOMAINS) {
    const count = newDomainCounts[nd] || 0;
    out.push(`  ${nd}: ${count}`);
  }
  const assigned = Object.values(newDomainCounts).reduce((a, b) => a + b, 0);
  out.push(`  已分配: ${assigned} / ${results.length} (缺主一级: ${results.filter(r => r.newPrimary.length === 0).length})`);

  // §3: 二级统计
  out.push('\n── §3 二级标签（出现次数）──');
  const secSorted = Object.keys(secondaryCounts).sort((a, b) => secondaryCounts[b] - secondaryCounts[a]);
  for (const s of secSorted) {
    out.push(`  ${s}: ${secondaryCounts[s]}`);
  }
  out.push(`  总计 ${allSecondaries.size} 个不同二级标签`);

  // §4: 跨组源
  out.push(`\n── §4 跨新一级组源: ${crossGroup.length} 个 ──`);
  for (const r of crossGroup) {
    out.push(`  ${r.file}`);
    out.push(`    旧: [${r.oldPrimary.join(', ')}] → 新: [${r.newPrimary.join(', ')}]`);
    out.push(`    ${r.title}  ${r.url}`);
  }

  // §5: 编码问题
  out.push(`\n── §5 编码/乱码问题: ${encodingIssues.length} 个 ──`);
  for (const r of encodingIssues) {
    out.push(`  ${r.file}  ${r.encodingIssues.join('; ')}`);
    out.push(`    domains: [${r.domains.join(', ')}]`);
  }

  // §6: 无一级的源
  out.push('\n── §6 无一级标签的源 ──');
  const noPrimary = results.filter(r => r.oldPrimary.length === 0);
  for (const r of noPrimary) {
    out.push(`  ${r.file}  domains: [${r.domains.join(', ')}]`);
  }

  const report = out.join('\n');
  console.log(report);

  // 写文件
  const outPath = path.join(__dirname, 'audit-report.txt');
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(`\n报告已写入: ${outPath}`);

  // 写 JSON 供后续脚本使用
  const jsonPath = path.join(__dirname, 'audit-data.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    files: results.length,
    oldDomainCounts,
    newDomainCounts,
    secondaryCounts,
    crossGroup,
    encodingIssues,
    noPrimary,
  }, null, 2), 'utf8');
  console.log(`数据已写入: ${jsonPath}`);
}

audit();
