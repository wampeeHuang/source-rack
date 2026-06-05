# Source Rack — 信息源策展系统

数据目录：`D:/Obsidian/wiki/entities/sources/`，一个 `.md` 一个源。
Web 面板：http://localhost:3098

## 收录标准

### 档位定义

三层信任分级——所有搜索场景的通用宪法：

| 档位 | 含义 | 标准 |
|------|------|------|
| **S** | 固定信源（权威源） | 无论如何都信任。跟使用频率无关——哪怕一个月没打开，依然相信。一手/权威/不可替代。例：Martin Fowler、ArXiv(有社区验证)、顶会论文、官方团队博客 |
| **A** | 补充信源 | 不够权威但可补充查阅。有可替代方案，交叉验证使用。例：知名科技媒体、Reddit 高赞讨论 |
| **block** | 黑名单 | 绝对不用。反爬严重（微信）、注水严重（知乎/CSDN）、低质/抄袭/SEO垃圾/内容农场。所有有搜索需求的 skill/工具自动跳过 |

### 收录门槛（五条，必须全部满足）
1. **一手优先**：原创/权威源，不收转载聚合站（如 RSS 聚合、今日热榜类）
2. **领域相关**：与当前工作领域至少一项交集（见下方领域分类法）
3. **有 why**：`why` 字段必填——不加理由的源不收
4. **持续更新**：更新频率 ≥ 月更（静态参考站标注 `[static]`，只收 A 档）
5. **URL 完整**：`url` 必须是完整 `https://` 地址，不许裸域名

### 领域分类法

**一级领域**（14 个，增删需修改 server.js DOMAIN_ORDER）：
`AI` `设计` `电商` `工具` `开发` `前端` `产品` `写作` `学习` `社区` `媒体` `参考` `搜索` `商业`

**二级领域**（从实际数据派生，不限个数，同源可多领域）：
二级领域与一级领域共现时自动建立父子关系（server.js 已实现）。

常用二级：`LLM` `Agent` `图像生成` `视频生成` `语音` `3D` `字体` `跨境电商` `品牌` `室内设计` `UI/UX` `数据分析` `RAG` `MCP` `OpenClaw`

## 卡片格式

每源一个 `.md` 文件，文件名 = `domain-name.md`（小写英文，无 `bm-` 前缀）：

```markdown
---
title: "网站名称"               # 必填，人可读的名称
url: https://www.example.com     # 必填，完整 HTTPS URL
tier: S                          # 必填，S | A | block
domains: [AI, LLM]               # 必填，至少一个一级领域
source_type: 权威源              # 必填，权威源 | 聚合源 | 平台 | 社区 | AI原生
tags: [paper, daily]             # 必填，至少一个
why: "每日AI论文一手更新"        # 必填，一句话收录理由
added: 2026-06-04                # 必填，首次收录日期
search: "site:example.com {query}"  # 可选，搜索策略模板
updated: 2026-06-04              # 可选，最近策展日期
---

# 网站名称

简短描述（1-2 句）。可用 [[Obsidian Wikilink]] 链接到相关概念/项目/人物。
```

### 字段规则
- **title**：网站的实际名称，不是 Chrome 书签路径（不要出现 `首页 \ 人类学` 这种东西）
- **url**：必须带 `https://`，必须能直接点开。裸域名（`perplexity.ai`）视为格式错误
- **tags**：至少 1 个，用英文小写。常见：`paper` `tutorial` `news` `daily` `reference` `tool` `inspiration` `community` `api` `opensource` `shopping`
- **type**：统一用 `source`（非旧的 `entity`）。旧文件 `type: entity` 不强制修改
- **文件名**：`{domain-name}.md`，如 `github-com.md`、`arxiv-org.md`。不用 `bm-` 前缀
- **正文**：1-2 句描述 + Obsidian `[[wikilinks]]` 建立双向链接

### 搜索策略（search 字段）

| source_type | 推荐 search 模板 |
|-------------|-----------------|
| 权威源 | `site:domain.com {query}` |
| 聚合源 | `站内搜→原链` |
| 平台 | `@账号限定 site:platform.com {query}` |
| 社区 | `搜+置信度 site:community.com {query}` |
| AI原生 | `API/结构化抓取` |

## AI 操作指南

### 添加信息源（推荐方式：API）
```bash
curl -X POST http://localhost:3098/sources \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Example Site",
    "url": "https://example.com",
    "tier": "A",
    "domains": ["AI"],
    "source_type": "权威源",
    "tags": ["research"],
    "why": "一句话理由"
  }'
```

### 添加信息源（备选：直接写文件）
按卡片格式创建 `.md` → 保存到 `D:/Obsidian/wiki/entities/sources/` → 刷新 :3098 即见。

### 策展维护
- 每月检查 S 档链接是否 404 → 降级或删除
- 发现更好替代源 → 旧源降级为 A，新源加入
- 领域分类不足 → 先用，积累 3+ 个同领域源再讨论是否加新分类
- **不批量修改旧文件**——350+ 个书签导入文件保持原样，新源严格按规范

### 新陈代谢（Decay & Prune）

**优胜劣汰规则：**

| 条件 | 动作 |
|------|------|
| `last_used` 空缺 + `added` > 90 天 | 标记为 **stale**，UI 半透明沉底 |
| `last_used` > 90 天（S 档） | 人工审查：还在用？→ 更新 `last_used`。不再用？→ 降级为 A |
| `last_used` > 90 天（A 档） | 候选删除。清理时优先删 |
| URL 返回 4xx/5xx | 标记为 **dead**。301/302 更新 URL，404 直接删 |
| `block` 档 | 不参与 decay（已标记为垃圾） |

**清理流程：**
1. 运行 `GET /sources/stale?days=90` → 获得候选列表，按 staleness 升序（最旧的排最前）
2. 人在面板看沉底的 stale 行（半透明 + 天数标记）→ 勾选想删的
3. AI 辅助：`grep -rl "tier: A" D:/Obsidian/wiki/entities/sources/ | xargs grep -l "added: 2026-05-29"` → 列出可删候选
4. 删前确认："这个源确定不再需要？"→ 删 `.md` 文件

** `last_used` 更新时机：**
- AI 在研究中引用了某个源 → 顺便 `POST /sources/touch` 更新时间戳
- 人在面板点了源的链接 → JS 自动发 `POST /sources/touch`
- 策展时手动编辑 frontmatter 的 `last_used` 字段

**面板排序逻辑：**
- 同档位内：`last_used` 降序 → `added` 降序 → 活跃在上、沉底在下
- 沉底的 = 候选清理区。用户想清一波时，从底部往上删

### 查询信息源
```
# 按领域查
grep -rl "domains:.*AI" D:/Obsidian/wiki/entities/sources/

# 查所有 stale 源（> 90 天未用）
curl -s http://localhost:3098/sources/stale?days=90 | python3 -m json.tool

# 按关键词搜
grep -rli "关键词" D:/Obsidian/wiki/entities/sources/

# 查所有 S 档
grep -rl "tier: S" D:/Obsidian/wiki/entities/sources/

# 浏览面板 → 沉底的 = 候选删除
http://localhost:3098
```

## Obsidian 集成
- 模板位置：`D:/Obsidian/wiki/_templates/source-card.md`
- Wikilink 格式：`[[概念名]]` 或 `[[概念名|显示文字]]`
- 源可以链接到概念、项目、人物——反向链接会自动出现在 Obsidian 面板
- 源的 `tags` 不映射到 Obsidian 原生标签（避免污染标签空间）

## 设计原则
1. **文件即真相源** — 无数据库，无后台冗余
2. **分类先于列举** — 两级领域 + 类型 + 档位，框架先于内容
3. **策展即权力** — 不加 why 不收，不策展等于没有
4. **生长 > 归档** — 系统价值 = 策展增量，不 = 文件数量
5. **优胜劣汰** — 不用的沉底，404 的淘汰。有生长就有代谢，只进不出是垃圾场

## 维护规则（踩坑记录）

### 服务部署
- **启动必须用绝对路径**：`node D:/projects/source-rack/server.js &`
- `cd D:/projects/source-rack && node server.js &` 在后台进程（&）中 CWD 可能不生效，导致运行旧版本或找不到文件
- 修改 server.js 后必须手动重启才能生效（无热重载）

### 字段兼容
- 旧 Chrome 书签导入使用 `created:` / `updated:` 而非 `added:` / `last_used:`
- `scanSources()` 的 `norm()` 负责标准化映射。新增字段名时必须同步更新该函数
- 面板排序、stale 检测、POST /sources/touch 均依赖 `added` 和 `last_used`

### CSS 规则
- `.tier-x` = block 档红色警示线（`#c00`），禁止重复定义
- `.src-url` = IKB 蓝（`var(--accent)`），不能用灰色——灰色看起来像失效链接
- `row.stale` = `opacity: 0.5`，stale 检测门限 > 90 天 + 无 `last_used`

### 档位进化
- 初始导入全 A 档是正常的——分类需要人工判断，不能一刀切
- 策展流程：AI 扫描候选 → 呈报用户确认 → 批量落盘
- S 档核心标准是**信任**，不是使用频率

## 自检闸门

页面左上角徽章实时反映真相源完整性。标准如下：

| 级别 | 触发条件 | 含义 | 操作 |
|------|---------|------|------|
| 🔴 闸门拦截 | 重复URL / 缺URL / 非法枚举值 | 真相源被破坏 | `node check.js` 定位 → 修复 → 重启 |
| 🟡 提醒 | 缺档位 / 缺类型 / 缺领域 | 元数据不完整 | `node standardize.js --dry-run` 预览 → 执行 |
| 🟢 通过 | 全部7项通过 | 唯一真相源完整自洽 | 无需操作 |

7 项原子检查：
1. 文件总数 — 服务端计数
2. URL 无重复 — 每个 URL 唯一
3. URL 无缺失 — 每个文件有 url
4. 档位无缺失 — 每个文件有 tier
5. 类型无缺失 — 每个文件有 source_type
6. 领域无缺失 — 每个文件有 domains
7. 枚举值合法 — tier ∈ {S,A,block}，source_type ∈ 合法集

实现：`server.js` 客户端 fetch `/health` → 展开面板查看逐项详情。`check.js` 是独立命令行版本（20 项检查，exit=1 硬闸门）。
