# 卡片格式

每源一个 `.md` 文件，文件名 = `domain-name.md`（小写英文，无 `bm-` 前缀）：

```markdown
---
title: "网站名称"               # 必填，人可读的名称
url: https://www.example.com     # 必填，完整 HTTPS URL
tier: A                          # 必填，S | A | X（算法动态计算，新源默认 A）
domains: [AI, LLM]               # 必填，至少一个一级领域
source_type: 权威源              # 必填，权威源 | 聚合源 | 平台 | 社区 | AI原生
tags: [灵感, 参考]               # 必填，至少一个，中文
why: "每日AI论文一手更新"        # 必填，一句话收录理由（禁止模板）
added: 2026-06-04                # 必填，首次收录日期
search: "site:example.com {query}"  # 可选，搜索策略模板
tier_override: S                 # 可选，锁定档位（S/A/X），删除即交还算法
click_dates: [2026-06-14, 2026-06-10]  # 系统自动维护，近30天点击日期
click_count: 12                  # 系统自动维护，历史累计点击
last_used: 2026-06-14            # 系统自动维护，最近点击日期
---

# 网站名称

简短描述（1-2 句）。可用 [[Obsidian Wikilink]] 链接到相关概念/项目/人物。
```

## 字段规则

- **title**：网站的实际名称，不是 Chrome 书签路径（不要出现 `首页 \ 人类学` 这种东西）
- **url**：必须带 `https://`，必须能直接点开。裸域名（`perplexity.ai`）视为格式错误
- **tier**：S/A/X，算法根据点击数自动计算。新源从 A 起步。人工可用 `tier_override` 锁定
- **tier_override**（可选）：锁定档位。设为 S/A/X 后不受算法影响。删除此字段交还算法
- **click_count**：系统自动维护，每次在面板点击链接 +1
- **tags**：至少 1 个，用中文。常见：`灵感` `参考` `资讯` `每日` `社区` `购物` `工具` `教程`
- **type**：统一用 `source`（非旧的 `entity`）。旧文件 `type: entity` 不强制修改
- **文件名**：`{domain-name}.md`，如 `github-com.md`、`arxiv-org.md`。不用 `bm-` 前缀
- **正文**：1-2 句描述 + Obsidian `[[wikilinks]]` 建立双向链接

## 搜索策略（search 字段）

| source_type | 推荐 search 模板 |
|-------------|-----------------|
| 权威源 | `site:domain.com {query}` |
| 聚合源 | `站内搜→原链` |
| 平台 | `@账号限定 site:platform.com {query}` |
| 社区 | `搜+置信度 site:community.com {query}` |
| AI原生 | `API/结构化抓取` |
