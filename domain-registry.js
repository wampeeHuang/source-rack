/**
 * domain-registry.js — 分类词表统一模块
 *
 * 真相源。server.js 和 check.js 共用此文件。
 * 修改分类体系只需改这一个文件。
 */
'use strict';

// ── 旧一级 → 新一级 ──────────────────────────────────────
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
  // 新一级恒等映射 — 防止新标签被误归为知识库
  '开发工具': '开发工具',
  '内容平台': '内容平台',
  '商业': '商业',
  '知识库': '知识库',
};

// ── 新一级展示排序 ──────────────────────────────────────
const PRIMARY_ORDER = ['AI', '设计', '电商', '开发工具', '内容平台', '商业', '知识库'];

// ── 新一级图标 ──────────────────────────────────────────
const PRIMARY_ICONS = {
  'AI': '🤖',
  '设计': '🎨',
  '电商': '🛒',
  '开发工具': '⚙️',
  '内容平台': '📡',
  '商业': '💼',
  '知识库': '📚',
};

// ── 新一级提示 ──────────────────────────────────────────
const PRIMARY_TIPS = {
  'AI': 'AI模型、工具、学习资源与行业资讯',
  '设计': '设计灵感、素材、工具——从浏览到制作全链路',
  '电商': '电商平台、跨境工具、选品与支付物流',
  '开发工具': '代码托管、部署、API与效率工具',
  '内容平台': '科技资讯、社交平台、创作者与社区',
  '商业': '众筹、变现、广告、IP版权、竞品研究',
  '知识库': '论文、图书、文档、教程与搜索工具',
};

// ── 二级归一化（近义词合并） ─────────────────────────────
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
  '选品灵感': '选品工具',
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
  '家具': '家具与材料',
  '材料': '家具与材料',
  '包管理': 'API',
  'IP管理': '云服务',
};

// ── 旧一级标签 → 二级推断 ─────────────────────────────
// 当旧一级标签（已被 OLD_TO_NEW 消费）也能暗示二级时
const PRIMARY_HINT_SECONDARY = {
  '建筑': '建筑与景观',
  '室内设计': '室内与家居',
  '家居生活': '室内与家居',
  '景观': '建筑与景观',
  '前端': 'UI/UX',
  '开发': '开发平台',
  '代码': '代码助手',
  '工具': '效率工具',
  '社区': '社交平台',
  '媒体': '资讯',
  '搜索': '通用搜索',
  '产品': '变现',
  '写作': '教程课程',
  '学习': '学习资源',
  '参考': '设计灵感',
};

// ── 旧二级 → 主一级强制覆盖 ─────────────────────────────
// 当旧二级标签暗示真正的领域归属时，覆盖旧一级的映射结果
const SECONDARY_OVERRIDE = {
  '电子工厂':     { primary: '商业', secondary: '竞品研究' },
  '招聘网站':     { primary: '商业', secondary: '招聘' },
  '广告平台':     { primary: '商业', secondary: '广告' },
  '众筹平台':     { primary: '商业', secondary: '众筹' },
  '创作者变现':   { primary: '商业', secondary: '变现' },
  '支付':         { primary: '电商', secondary: '支付物流' },
  '版权识别':     { primary: '商业', secondary: 'IP版权' },
  '流量追踪':     { primary: '商业', secondary: '广告' },
  '数字藏品':     { primary: '商业', secondary: 'IP版权' },
};

// ── 各一级下的合法二级（闭合词表） ─────────────────────
const SECONDARY_REGISTRY = {
  'AI':     ['LLM','Agent','图像生成','视频生成','语音','3D生成','开发平台','学习资源','资讯','社交平台','代码助手','代码托管','API','通用搜索','技术社区','自动化','自动化工具','效率工具','未细分'],
  '设计':   ['设计灵感','设计素材','设计工具','室内与家居','建筑与景观','家具与材料','UI/UX','品牌与平面','社交平台','图书档案','电商服务','动效','未细分'],
  '电商':   ['国内电商','跨境电商','选品工具','支付物流','电商服务','电商社区','未细分'],
  '开发工具': ['代码托管','部署平台','API','云服务','开发平台','UI/UX','设计工具','技术社区','文档手册','知识管理','自动化工具','效率工具','未细分'],
  '内容平台': ['科技资讯','资讯','社交平台','内容平台','创作者平台','设计工具','技术社区','未细分'],
  '商业':   ['众筹','变现','广告','IP版权','招聘','竞品研究','未细分'],
  '知识库': ['学术论文','图书档案','文档手册','教程课程','通用搜索','设计灵感','未细分'],
};

// ── 跨一级源的主归属优先级 ──────────────────────────────
// 当一个源有多个旧一级标签时，按此优先级选主一级
// 数值越小优先级越高
const PRIMARY_PRIORITY = {
  'AI': 10,
  '设计': 20,
  '电商': 30,
  '开发工具': 40,
  '内容平台': 50,
  '商业': 60,
  '知识库': 70,
};

// ═══════════════════════════════════════════════════════════
// 核心函数
// ═══════════════════════════════════════════════════════════

/**
 * 将旧 domains 数组规范化为新分类体系
 *
 * @param {string[]} oldDomains — 源文件中的 domains 数组（混合了一级和二级）
 * @param {string} [title] — 源标题（可选，用于日志）
 * @param {string} [url] — 源 URL（可选，用于日志）
 * @returns {{ primary: string, secondary: string, crossTags: string[], legacyPrimary: string[], legacySecondary: string[] }}
 */
function normalizeDomains(oldDomains, title, url) {
  if (!Array.isArray(oldDomains) || oldDomains.length === 0) {
    return {
      primary: null,
      secondary: '未细分',
      crossTags: [],
      legacyPrimary: [],
      legacySecondary: [],
    };
  }

  // 分离旧一级和旧二级
  const legacyPrimary = [];
  const legacySecondary = [];

  for (const d of oldDomains) {
    if (OLD_TO_NEW.hasOwnProperty(d)) {
      legacyPrimary.push(d);
    } else {
      legacySecondary.push(d);
    }
  }

  // 第一步：从旧一级映射候选新一级
  const candidates = [];
  for (const lp of legacyPrimary) {
    const np = OLD_TO_NEW[lp];
    if (np && !candidates.includes(np)) {
      candidates.push(np);
    }
  }

  // 第二步：检查旧二级是否强制覆盖主一级
  let forcedPrimary = null;
  let forcedSecondary = null;
  for (const sec of legacySecondary) {
    const override = SECONDARY_OVERRIDE[sec];
    if (override && !candidates.includes(override.primary)) {
      forcedPrimary = override.primary;
      forcedSecondary = override.secondary;
    }
  }

  // 如果有强制覆盖，插入候选列表最前
  if (forcedPrimary && !candidates.includes(forcedPrimary)) {
    candidates.unshift(forcedPrimary);
  }

  // 第三步：选主一级（强制覆盖 > 优先级 > 默认）
  let primary = null;
  if (forcedPrimary) {
    // 二级覆盖指明的主归属无条件胜出
    primary = forcedPrimary;
  } else if (candidates.length === 1) {
    primary = candidates[0];
  } else if (candidates.length > 1) {
    // 按优先级排序取最优先的
    candidates.sort((a, b) => (PRIMARY_PRIORITY[a] || 99) - (PRIMARY_PRIORITY[b] || 99));
    primary = candidates[0];
  }

  // 跨组标签
  const crossTags = candidates.length > 1 ? candidates.slice(1) : [];

  // 第四步：确定二级
  let secondary = '未细分';

  // 先看是否有强制覆盖的二级
  if (forcedSecondary) {
    secondary = forcedSecondary;
  }

  // 再看旧二级是否匹配新二级词表
  if (secondary === '未细分') {
    for (const sec of legacySecondary) {
      const normed = SECONDARY_NORM[sec] || sec;

      // 检查 OVERRIDE（不强制主归属但指明了二级）
      const override = SECONDARY_OVERRIDE[sec];
      if (override && override.primary === primary) {
        secondary = override.secondary;
        break;
      }

      // 检查闭合词表
      const registry = SECONDARY_REGISTRY[primary] || [];
      if (registry.includes(normed)) {
        secondary = normed;
        break;
      }
    }
  }

  // 第五步：从 legacyPrimary 推断二级（旧标签全是 primary 级时）
  if (secondary === '未细分' && legacyPrimary.length > 0) {
    for (const lp of legacyPrimary) {
      const hint = PRIMARY_HINT_SECONDARY[lp];
      if (hint) {
        // 优先看主一级的 registry，再看全局
        const primReg = SECONDARY_REGISTRY[primary] || [];
        if (primReg.includes(hint)) {
          secondary = hint;
          break;
        }
        // 跨 registry 也可以接受
        for (const [p, reg] of Object.entries(SECONDARY_REGISTRY)) {
          if (reg.includes(hint)) {
            secondary = hint;
            break;
          }
        }
        if (secondary !== '未细分') break;
      }
    }
  }

  // Legacy alias — 保留旧一级标签作为 display-only 别名
  return {
    primary,
    secondary,
    crossTags,
    legacyPrimary,
    legacySecondary,
  };
}

/**
 * 获取给定一级下所有合法二级（供 UI 筛选用）
 */
function getValidSecondaries(primary) {
  return SECONDARY_REGISTRY[primary] || [];
}

/**
 * 检查一个一级标签是否为合法新一级
 */
function isValidPrimary(domain) {
  return PRIMARY_ORDER.includes(domain);
}

// ═══════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════

module.exports = {
  // 常量
  OLD_TO_NEW,
  PRIMARY_ORDER,
  PRIMARY_ICONS,
  PRIMARY_TIPS,
  SECONDARY_NORM,
  SECONDARY_OVERRIDE,
  SECONDARY_REGISTRY,
  PRIMARY_PRIORITY,
  PRIMARY_HINT_SECONDARY,

  // 函数
  normalizeDomains,
  getValidSecondaries,
  isValidPrimary,
};
