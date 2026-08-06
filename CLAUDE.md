# Source Rack · 文件夹宪法

> 信息源策展系统。Web 面板 → `http://localhost:3098`。
> 品牌套件：[版式画廊](D:\workspace\layout-gallery\templates\layout-gallery\brand.json)

## 目录结构

```
source-rack/
├── .gitignore
├── .project                 ← workspace 身份证
├── CLAUDE.md               ← 本文件
├── README.md                ← 人类用面板说明
├── _runtime/               ← 会话临时（gitignored）
│   ├── CHECKPOINT.md       自动写入
│   └── HANDOFF.md          会话交接
├── assets/                 ← 前端资源 + 设计令牌
│   ├── app.css             全部样式（token-only）
│   ├── app.js              客户端逻辑（事件委托）
│   ├── logo.svg            favicon + header logo
│   └── tokens/
│       ├── brand.css       品牌基因（从画廊同步，只读）
│       └── layout.css      布局变量（本项目定义）
├── domain-registry.js       ← 领域词表（7域 + OLD_TO_NEW 映射）
├── package-lock.json
├── package.json
├── references/             ← 长文规则（按需加载）
│   ├── tier-system.md      档位定义 S/A/X
│   ├── domains.md          领域分类 + Agent 写入流程
│   ├── decay-rules.md      收录门槛 + 新陈代谢
│   ├── card-format.md      卡片字段规范
│   ├── design-principles.md 6条设计原则
│   ├── architecture.md     系统架构 + Token 架构
│   ├── checklist.md        门禁清单
│   ├── maintenance.md      踩坑记录
│   └── architecture.svg    架构图
├── scripts/                ← 可执行闸门
│   ├── check.js            22项检查，exit 0 = 通过
│   └── standardize.js      批量标准化
└── server.js               ← Express 入口
```

## 四槽位

| 槽位 | 放什么 | 不放什么 |
|------|--------|---------|
| `references/` | 规则文档、分类法、checklist、设计原则 | 脚本、模板、数据 |
| `scripts/` | 闸门脚本（验证/检查/标准化） | 规则文档 |
| `assets/` | CSS、JS、SVG、favicon、设计令牌 | 业务逻辑（在 server.js） |
| `_runtime/` | CHECKPOINT、HANDOFF、会话临时文件 | 源码、配置、持久数据 |

## 核心规则

1. **数据在外不在内。** 信息源数据在 `D:/Obsidian/wiki/entities/sources/`（593个 .md 文件），本项目不存业务数据，只做 web 面板呈现。
2. **写入必须过闸。** 改源后跑 `node scripts/check.js`，exit 0 才算通过。22 项闸门任一项不过 = 不过。
3. **Token 铁律。** CSS 只写 `var(--token)`，不写裸色值。品牌基因改画廊、同步到 `assets/tokens/brand.css`。布局 token 在本项目 `assets/tokens/layout.css` 改。
4. **一个规则一个家。** 每条规则只在 references/ 存一份。入口只路由不内联。
5. **引用不复制。** 架构图、卡片格式、CSS 规则不跨文件重复。读者无法判断"哪个版本是真的"→ 架构错了。

## 路由

| 我要做什么 | 去哪 |
|-----------|------|
| 添加信息源 | `references/domains.md` §Agent 写入流程 |
| 查档位算法 (S/A/X) | `references/tier-system.md` |
| 查收录/淘汰规则 | `references/decay-rules.md` |
| 查卡片字段格式 | `references/card-format.md` |
| 理解系统架构 | `references/architecture.md` |
| 品牌 Token 规则 | `references/architecture.md` §Token 架构 |
| 运行闸门检查 | `node scripts/check.js` |
| 批量标准化 | `node scripts/standardize.js` |
| 部署/兼容/样式踩坑 | `references/maintenance.md` |
| 设计原则 | `references/design-principles.md` |
| 完整门禁清单 | `references/checklist.md` |

## 自检闸门

`node scripts/check.js` — 22 项检查，exit 0 = 全部通过。页面左上角徽章实时反映。
