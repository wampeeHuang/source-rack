# Source Rack — 信息源策展系统

数据目录：`D:/Obsidian/wiki/entities/sources/`，一个 `.md` 一个源。
Web 面板：http://localhost:3098
品牌套件：[D:\workspace\layout-gallery\templates\layout-gallery\brand.json](D:\workspace\layout-gallery\templates\layout-gallery\brand.json)

**审查机制**: `_review/` 目录存在时，先读 `_review/brief.md` 了解待审内容，反馈写入 `_review/findings.md`。

**投料箱**: `inbox/` — 用户-Agent 交互投料区。用户把要给 Agent 的资料放这里，Agent 启动时检查。文件名即描述，处理完清空。

## 规则文件

| 文件 | 内容 |
|------|------|
| [references/tier-system.md](references/tier-system.md) | 档位定义（S/A/X）+ 算法进化规则 |
| [references/domains.md](references/domains.md) | 领域分类法（7 一级 + 二级词表）+ Agent 添加源流程 |
| [references/decay-rules.md](references/decay-rules.md) | 收录门槛 + 新陈代谢淘汰规则 |
| [references/card-format.md](references/card-format.md) | 卡片字段规范 + 搜索策略 |
| [references/design-principles.md](references/design-principles.md) | 6 条设计原则 |
| [references/architecture.md](references/architecture.md) | 系统架构 + 数据流 + Token 架构 |
| [references/checklist.md](references/checklist.md) | 门禁清单（提交前/收录前/品牌变更后/架构变更后） |

## 品牌套件

本应用是一套个人品牌的一部分。品牌基因由版式画廊定义，所有应用共享。

**铁律：品牌基因共享，布局各自定义。** 改颜色/字体/圆角去画廊改完同步过来。改间距/字号/组件尺寸在本项目改。

- 组件 CSS 只引用 token 变量，不写裸值（`var(--color-primary)` 不是 `#3D6B4A`）
- 新 token 需求：品牌级往画廊提，布局级在本项目 `tokens/layout.css` 加
- 画廊品牌基因更新后 → 手动同步到 `tokens/brand.css` → 重启服务器

详见图：[references/architecture.md](references/architecture.md) §Token 架构

## AI 操作指南

### Agent 写入流程

```
1. 读词表 → node -e "require('./domain-registry')" 查合法标签
2. 写文件 → 按卡片格式写 .md 到 D:/Obsidian/wiki/entities/sources/
3. 验证 → node scripts/check.js
4. 刷新 → http://localhost:3098 确认显示正常
```

核心规则：
- domains 标签必须来自 `domain-registry.js` 词表，不在词表的标签会被归一化为"未细分"
- 新源 tier 默认 A
- 文件名 = `{domain-name}.md`，从 URL 派生
- **why 字段禁止模板**（如"设计·网页设计 聚合源"），必须手写真实描述

格式详见：[references/card-format.md](references/card-format.md)
门禁详见：[references/checklist.md](references/checklist.md)

### 添加信息源（API）
```bash
curl -X POST http://localhost:3098/sources \
  -H "Content-Type: application/json" \
  -d '{"title":"Example Site","url":"https://example.com","tier":"A","domains":["AI"],"source_type":"权威源","tags":["灵感"],"why":"一句话理由"}'
```

### 查询信息源
```
# 按领域查
grep -rl "domains:.*AI" D:/Obsidian/wiki/entities/sources/

# 查所有 stale 源
curl -s http://localhost:3098/sources/stale?days=90

# 按关键词搜
grep -rli "关键词" D:/Obsidian/wiki/entities/sources/

# 浏览面板
http://localhost:3098
```

### 策展维护
- 每月检查 S 档链接是否 404 → 降级或删除
- 发现更好替代源 → 旧源降级为 A，新源加入
- 领域分类不足 → 先用，积累 3+ 个同领域源再讨论是否加新分类
- **不批量修改旧文件**——350+ 个书签导入文件保持原样，新源严格按规范

新陈代谢规则详见：[references/decay-rules.md](references/decay-rules.md)

## Obsidian 集成

- 模板位置：`D:/Obsidian/wiki/_templates/source-card.md`
- Wikilink 格式：`[[概念名]]` 或 `[[概念名|显示文字]]`
- 源可以链接到概念、项目、人物——反向链接会自动出现在 Obsidian 面板

## 维护规则（踩坑记录）

### 服务部署
- **启动必须用绝对路径**：`node D:/workspace/source-rack/server.js`
- `cd D:/projects/source-rack && node server.js &` 在后台进程中 CWD 可能不生效
- 修改 server.js 后必须手动重启才能生效（无热重载）

### 字段兼容
- 旧 Chrome 书签导入使用 `created:` / `updated:` 而非 `added:` / `last_used:`
- `scanSources()` 的 `norm()` 负责标准化映射。新增字段名时必须同步更新该函数
- 面板排序、stale 检测、POST /sources/touch 均依赖 `added` 和 `last_used`

### CSS 规则
- `.tier-x` = X 档红色警示线，禁止重复定义
- `.src-url` = 品牌主色，不能用灰色——灰色看起来像失效链接
- `row.stale` = `opacity: 0.5`，stale 检测门限 > 90 天 + 无 `last_used`

## 自检闸门

页面左上角徽章实时反映真相源完整性。运行 `node scripts/check.js` 获取完整报告。

| 级别 | 触发条件 | 操作 |
|------|---------|------|
| 🔴 闸门拦截 | 重复URL / 缺URL / 非法枚举值 | `node scripts/check.js` 定位 → 修复 → 重启 |
| 🟡 提醒 | 缺档位 / 缺类型 / 缺领域 | `node scripts/standardize.js --dry-run` 预览 → 执行 |
| 🟢 通过 | 全部 7+ 项通过 | 无需操作 |

完整门禁清单：[references/checklist.md](references/checklist.md)
