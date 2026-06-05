# Source Rack — 信息源策展系统

**MD 文件即唯一真相源。** 522 个 Markdown 文件 → 只读 Web 面板 → 实时自检闸门。

## 架构

```
MD 文件 (D:/Obsidian/wiki/entities/sources/*.md)
       │
       ▼  scanSources() 只读
  server.js ──► http://localhost:3098
       │
       ▼  fetch /health
  自检闸门 (check.js)
```

无数据库，无缓存，无后台冗余。文件是唯一的真相源，server.js 是只读投影。

## 快速开始

```bash
npm install
npm start        # 启动面板 → http://localhost:3098
npm run check    # 跑自检闸门
```

默认读取 `$SOURCES_DIR` 环境变量，未设置则用 `D:/Obsidian/wiki/entities/sources`。

## 脚本

| 命令 | 用途 |
|------|------|
| `npm start` | 启动 Web 面板 |
| `npm run check` | 20 项自检闸门（exit=1 硬拦截） |
| `npm run standardize` | 预览标准化修复 |
| `npm run standardize:apply` | 执行标准化修复 |
| `npm run dedup` | 预览 URL 去重 |
| `npm run dedup:apply` | 执行 URL 去重 |

## 自检闸门

页面左上角彩色圆点实时反映真相源状态：

- ● 绿 — 唯一真相源自洽
- ● 黄 — 元数据不全 → 对 AI 说「标准化」
- ● 红 — 源架受损 → 对 AI 说「修闸门」

## 数据格式

每个 `.md` 文件一个信息源，YAML frontmatter：

```yaml
title: "示例源"
url: https://example.com
tier: A
domains: ["AI", "Agent"]
source_type: 聚合源
tags: ["reference"]
why: "AI Agent 聚合源"
added: 2026-06-04
```

完整规范见 `CLAUDE.md`。

## 许可证

MIT
