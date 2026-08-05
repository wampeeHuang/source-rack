/**
 * normalizeDomains() 验收测试 — 跑全量 594 源
 */
const fs = require('fs');
const path = require('path');
const { normalizeDomains, PRIMARY_ORDER, SECONDARY_REGISTRY, isValidPrimary } = require('../domain-registry.js');

const SRCDIR = 'D:/Obsidian/wiki/entities/sources';

function parseSource(fpath, fname) {
  let raw;
  try { raw = fs.readFileSync(fpath, 'utf8'); } catch (e) { return null; }
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1];
  const getF = (field) => {
    const re = new RegExp(`^${field}:\\s*(.+)$`, 'm');
    const r = fm.match(re);
    return r ? r[1].trim() : '';
  };
  const dm = fm.match(/^domains:\s*\[([^\]]*)\]/m);
  let domains = [];
  if (dm) {
    domains = dm[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }
  return { file: fname, title: getF('title'), url: getF('url'), domains };
}

function validate() {
  const files = fs.readdirSync(SRCDIR).filter(f => f.endsWith('.md'));
  const errors = [];
  const primaryCounts = {};
  const secondaryCounts = {};
  const crossSources = [];

  for (const f of files) {
    const src = parseSource(path.join(SRCDIR, f), f);
    if (!src) { errors.push({ file: f, error: 'PARSE_FAILED' }); continue; }

    const result = normalizeDomains(src.domains, src.title, src.url);

    // 检查 1: primary 是合法值
    if (!isValidPrimary(result.primary)) {
      errors.push({ file: f, error: 'INVALID_PRIMARY', value: result.primary, domains: src.domains });
    }

    // 检查 2: secondary 在闭合词表中
    const validSecondaries = SECONDARY_REGISTRY[result.primary] || [];
    if (result.secondary !== '未细分' && !validSecondaries.includes(result.secondary)) {
      errors.push({
        file: f, error: 'INVALID_SECONDARY',
        primary: result.primary, secondary: result.secondary,
        valid: validSecondaries, domains: src.domains,
      });
    }

    // 检查 3: 有 primary
    if (!result.primary) {
      errors.push({ file: f, error: 'NO_PRIMARY', domains: src.domains });
    }

    // 统计
    primaryCounts[result.primary] = (primaryCounts[result.primary] || 0) + 1;
    secondaryCounts[result.secondary] = (secondaryCounts[result.secondary] || 0) + 1;

    if (result.crossTags.length > 0) {
      crossSources.push({
        file: f,
        primary: result.primary,
        crossTags: result.crossTags,
        oldDomains: src.domains,
      });
    }
  }

  const totalAssigned = Object.values(primaryCounts).reduce((a, b) => a + b, 0);

  console.log('═══════════════════════════════════════════════');
  console.log(' normalizeDomains() 验收测试');
  console.log(` 源总数: ${files.length}  已分配: ${totalAssigned}`);
  console.log(` 错误: ${errors.length}  跨组源: ${crossSources.length}`);
  console.log('═══════════════════════════════════════════════');

  console.log('\n── 一级分布 ──');
  for (const p of PRIMARY_ORDER) {
    const c = primaryCounts[p] || 0;
    const bar = '█'.repeat(Math.round(c / 10));
    console.log(`  ${p}: ${c} ${bar}`);
  }
  console.log(`  合计: ${totalAssigned}`);

  console.log('\n── 二级分布 ──');
  const secSorted = Object.entries(secondaryCounts).sort((a, b) => b[1] - a[1]);
  for (const [s, c] of secSorted) {
    console.log(`  ${s}: ${c}`);
  }

  if (errors.length > 0) {
    console.log(`\n── ❌ 错误: ${errors.length} ──`);
    for (const e of errors) {
      console.log(`  ${e.file}: ${e.error}`, e.value ? `(${e.value})` : '', e.domains ? `domains=${JSON.stringify(e.domains)}` : '');
    }
  }

  console.log('\n── 跨组源（主一级 + 交叉标签）──');
  for (const cs of crossSources) {
    console.log(`  ${cs.file}: primary=${cs.primary} cross=[${cs.crossTags.join(', ')}] old=[${cs.oldDomains.join(', ')}]`);
  }

  // 断言
  console.log('\n═══════════════════════════════════════════════');
  if (totalAssigned === files.length && errors.length === 0) {
    console.log(' ✅ 验收通过');
    console.log(`    ${totalAssigned}/${files.length} 源全部正确分类`);
    console.log('    0 无效主一级、0 无效二级');
  } else {
    console.log(' ❌ 验收失败');
    if (totalAssigned !== files.length) console.log(`    缺口: ${files.length - totalAssigned} 源未分配`);
    if (errors.length > 0) console.log(`    ${errors.length} 个错误`);
    process.exit(1);
  }
}

validate();
