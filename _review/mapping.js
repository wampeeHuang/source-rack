/**
 * Phase 0 Step 2 — 生成旧→新全量映射表
 * 输出: mapping.csv (逐源映射), mapping-summary.json (统计)
 */
const fs = require('fs');
const path = require('path');

const SRCDIR = 'D:/Obsidian/wiki/entities/sources';

// ── 旧一级 → 新一级 ────────────────────────────────────
const OLD_TO_NEW = {
  'AI': 'AI', '设计': '设计', '建筑': '设计', '室内设计': '设计',
  '家居生活': '设计', '景观': '设计', '电商': '电商',
  '工具': '开发工具', '开发': '开发工具', '前端': '开发工具',
  '产品': '商业', '写作': '知识库', '学习': '知识库',
  '社区': '内容平台', '媒体': '内容平台', '参考': '知识库', '搜索': '知识库',
};

// ── 旧二级 → (新一级强制覆盖, 新二级, 备注) ────────────
// 仅列出"旧二级改变了主归属"的情况
const SECONDARY_OVERRIDE = {
  'IP管理':       { forcePrimary: '商业', secondary: 'IP版权', note: '用户裁决' },
  '电子工厂':     { forcePrimary: '商业', secondary: '竞品研究', note: '用户裁决：PCBA参考' },
  '招聘网站':     { forcePrimary: '商业', secondary: '招聘', note: '用户裁决' },
  '广告平台':     { forcePrimary: '商业', secondary: '广告', note: '商业变现工具' },
  '众筹平台':     { forcePrimary: '商业', secondary: '众筹', note: '商业环节' },
  '创作者变现':   { forcePrimary: '商业', secondary: '变现', note: '商业环节' },
  '支付':         { forcePrimary: '电商', secondary: '支付物流', note: '电商基础设施' },
  '版权识别':     { forcePrimary: '商业', secondary: 'IP版权', note: '归属商业' },
  '流量追踪':     { forcePrimary: '商业', secondary: '广告', note: '广告分析工具' },
  '数字藏品':     { forcePrimary: '商业', secondary: 'IP版权', note: '归属商业' },
};

// ── 二级归一化 (近义词合并) ─────────────────────────────
const SECONDARY_NORM = {
  '图片素材': '设计素材', '视频素材': '设计素材', '字体素材': '设计素材',
  '3D素材': '设计素材', 'logo素材': '设计素材',
  '设计参考': '设计灵感',
  '文档参考': '文档手册',
  '代码': '代码托管',
  'AI工具': '代码助手',
  '创作工具': '设计工具',
  '电商EPR': '电商服务',
  '电商工具': '电商服务',
  '电商社区': '电商社区',
  '选品灵感': '选品工具',
  '家具': '家具与材料',
  '材料': '家具与材料',
  '包管理': 'API',
  '文学平台': '内容平台',
  '架构图': '设计工具',
  '流程图': '设计工具',
  '图片处理': '设计工具',
  '去水印/抠图': '设计工具',
  '色彩工具': '设计工具',
  '个人站点': '社交平台',
  '博客': '社交平台',
  '技术问答': '技术社区',
  'UI组件': 'UI/UX',
  '网页设计': 'UI/UX',
  '文件处理': '效率工具',
  '翻译工具': '效率工具',
  '存储网盘': '效率工具',
  '邮箱': '效率工具',
  '自动化': '自动化工具',
  '合规服务': '电商服务',
};

// ── 新二级词表（闭合集合） ──────────────────────────────
const AI_SECONDARIES      = ['LLM','Agent','图像生成','视频生成','语音','3D生成','开发平台','学习资源','资讯','代码助手','自动化','未细分'];
const DESIGN_SECONDARIES  = ['设计灵感','设计素材','设计工具','室内与家居','建筑与景观','家具与材料','UI/UX','品牌与平面','动效','未细分'];
const ECOM_SECONDARIES    = ['国内电商','跨境电商','选品工具','支付物流','电商服务','电商社区','未细分'];
const DEV_SECONDARIES     = ['代码托管','部署平台','API','云服务','知识管理','自动化工具','效率工具','未细分'];
const CONTENT_SECONDARIES = ['科技资讯','社交平台','内容平台','创作者平台','技术社区','未细分'];
const BIZ_SECONDARIES     = ['众筹','变现','广告','IP版权','招聘','竞品研究','未细分'];
const KNOW_SECONDARIES    = ['学术论文','图书档案','文档手册','教程课程','通用搜索','未细分'];

const SECONDARY_REGISTRY = {
  'AI': AI_SECONDARIES, '设计': DESIGN_SECONDARIES, '电商': ECOM_SECONDARIES,
  '开发工具': DEV_SECONDARIES, '内容平台': CONTENT_SECONDARIES,
  '商业': BIZ_SECONDARIES, '知识库': KNOW_SECONDARIES,
};

// ── 旧二级 → 新一级+新二级 推断（不在 OVERRIDE 表里的） ──
function classifySecondary(sec, currentPrimary) {
  // 已归一化
  const normed = SECONDARY_NORM[sec] || sec;

  // 检查 OVERRIDE
  if (SECONDARY_OVERRIDE[sec]) {
    const o = SECONDARY_OVERRIDE[sec];
    return { forcePrimary: o.forcePrimary, secondary: o.secondary, note: o.note };
  }
  if (SECONDARY_OVERRIDE[normed]) {
    const o = SECONDARY_OVERRIDE[normed];
    return { forcePrimary: o.forcePrimary, secondary: o.secondary, note: o.note };
  }

  // 基于当前 primary 推断二级归属
  // AI 域二级
  if (['LLM','Agent','图像生成','视频生成','语音','3D生成','开发平台','学习资源','资讯','代码助手','自动化'].includes(normed)) {
    return { forcePrimary: null, secondary: normed, note: 'AI类' };
  }
  // 设计域二级
  if (['设计灵感','设计素材','设计工具','室内与家居','建筑与景观','家具与材料','UI/UX','品牌与平面','动效'].includes(normed)) {
    return { forcePrimary: null, secondary: normed, note: '设计类' };
  }
  // 电商域二级
  if (['国内电商','跨境电商','选品工具','支付物流','电商服务','电商社区'].includes(normed)) {
    return { forcePrimary: null, secondary: normed, note: '电商类' };
  }
  // 工具/开发
  if (['代码托管','部署平台','API','云服务','知识管理','自动化工具','效率工具'].includes(normed)) {
    return { forcePrimary: null, secondary: normed, note: '工具开发类' };
  }
  // 媒体/社区
  if (['科技资讯','社交平台','内容平台','创作者平台','技术社区'].includes(normed)) {
    return { forcePrimary: null, secondary: normed, note: '内容平台类' };
  }
  // 商业
  if (['众筹','变现','广告','IP版权','招聘','竞品研究'].includes(normed)) {
    return { forcePrimary: null, secondary: normed, note: '商业类' };
  }
  // 知识库
  if (['学术论文','图书档案','文档手册','教程课程','通用搜索'].includes(normed)) {
    return { forcePrimary: null, secondary: normed, note: '知识库类' };
  }

  // 未匹配 — 需人工裁决
  return { forcePrimary: null, secondary: normed, note: 'UNMAPPED' };
}

// ── 读取并解析 ──────────────────────────────────────────
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

  return {
    file: fname,
    title: getF('title'),
    url: getF('url'),
    domains,
    source_type: getF('source_type'),
    tags: getF('tags'),
  };
}

// ── 主流程 ──────────────────────────────────────────────
function run() {
  const files = fs.readdirSync(SRCDIR).filter(f => f.endsWith('.md'));
  const sources = files.map(f => parseSource(path.join(SRCDIR, f), f)).filter(Boolean);

  // CSV 表头
  const csvRows = ['file,title,old_domains,old_primary,old_secondary,new_primary,new_secondary,override_reason,cross_tags'];

  const unMapped = [];
  const finalPrimaryCounts = {};
  const finalSecondaryCounts = {};

  for (const src of sources) {
    const oldPrimaries = src.domains.filter(d => OLD_TO_NEW.hasOwnProperty(d));
    const oldSecondaries = src.domains.filter(d => !OLD_TO_NEW.hasOwnProperty(d));

    // 第一步：从旧一级确定候选新一级
    let newPrimaries = [...new Set(oldPrimaries.map(d => OLD_TO_NEW[d]).filter(Boolean))];

    // 第二步：检查旧二级是否强制覆盖一级
    let overrideReason = '';
    for (const sec of oldSecondaries) {
      const cls = classifySecondary(sec, newPrimaries[0] || '');
      if (cls.forcePrimary && !newPrimaries.includes(cls.forcePrimary)) {
        newPrimaries.unshift(cls.forcePrimary); // 强制排最前
        overrideReason = cls.note + ':' + sec;
      }
    }

    // 第三步：确定主一级
    const mainPrimary = newPrimaries[0] || '未分类';
    finalPrimaryCounts[mainPrimary] = (finalPrimaryCounts[mainPrimary] || 0) + 1;

    // 第四步：确定主二级
    let mainSecondary = '未细分';
    for (const sec of oldSecondaries) {
      const cls = classifySecondary(sec, mainPrimary);
      if (cls.secondary) {
        mainSecondary = cls.secondary;
        break;
      }
    }
    // 如果没有旧二级，尝试从旧一级继承（如 电商→跨境电商 默认）
    if (!mainSecondary || mainSecondary === '未细分') {
      // 可以对某些一级设置默认二级
      if (mainPrimary === '电商') mainSecondary = '未细分';
    }

    finalSecondaryCounts[mainSecondary] = (finalSecondaryCounts[mainSecondary] || 0) + 1;

    // 跨组标签（旧 PRIMARY 中不属于主一级的其他标签对应的新一级）
    const crossTags = newPrimaries.slice(1);

    // 记录未映射的二级
    for (const sec of oldSecondaries) {
      const cls = classifySecondary(sec, mainPrimary);
      if (cls.note === 'UNMAPPED') {
        unMapped.push({ file: src.file, secondary: sec, primary: mainPrimary });
      }
    }

    csvRows.push([
      src.file,
      `"${(src.title || '').replace(/"/g, '""')}"`,
      `"${src.domains.join(', ')}"`,
      oldPrimaries.join('|'),
      oldSecondaries.join('|'),
      mainPrimary,
      mainSecondary,
      overrideReason,
      crossTags.join('|'),
    ].join(','));
  }

  // ── 写 CSV ────────────────────────────────────────────
  const csvPath = path.join(__dirname, 'mapping.csv');
  fs.writeFileSync(csvPath, '﻿' + csvRows.join('\n'), 'utf8'); // BOM for Excel

  // ── 汇总 ──────────────────────────────────────────────
  const summary = {
    total: sources.length,
    primaryCounts: finalPrimaryCounts,
    secondaryCounts: finalSecondaryCounts,
    unMapped,
    unmappedCount: unMapped.length,
  };

  const jsonPath = path.join(__dirname, 'mapping-summary.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

  // ── 控制台输出 ────────────────────────────────────────
  console.log('── 新一级唯一源分布 ──');
  for (const [k, v] of Object.entries(finalPrimaryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`\n── 新二级分布 ──`);
  for (const [k, v] of Object.entries(finalSecondaryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`\n── 未映射二级: ${unMapped.length} ──`);
  for (const u of unMapped) {
    console.log(`  ${u.file}: "${u.secondary}" (当前一级: ${u.primary})`);
  }
  console.log(`\nCSV: ${csvPath}`);
  console.log(`JSON: ${jsonPath}`);
}

run();
