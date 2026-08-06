# 系统架构

SVG 架构图：`references/architecture.svg`（唯一真相源）。server.js 启动时 `fs.readFileSync` 读入注入页面。

## 数据流

```
发现 → 收录 → 存储 → 查询 → 代谢
  ↑                              │
  └──── 反馈循环 · 越用越活 ─────┘
```

| 层 | 位置 | 说明 |
|----|------|------|
| INPUT | AI 对话 / 用户推荐 | 新源发现渠道 |
| API | `POST /sources` 校验落盘 | server.js 写入 MD 文件 |
| VAULT | Obsidian .md YAML frontmatter | 文件即真相源 |
| SURFACE | 面板过滤 + AI grep 检索 | 只读查询 |
| DECAY | last_used 排序 · 沉底淘汰 | 自动化新陈代谢 |

## Token 架构

```
品牌基因（layout-gallery/brand.json）    ← 唯一真相源
  └→ tokens/brand.css                   ← 投影，勿直接改
      颜色 13 · 字体 3 · 动效 4 · 阴影 2 · 圆角 3

布局规则（tokens/layout.css）            ← 本应用真相源
  字号 6 · 间距 9 · 页面结构 · 组件尺寸
```

**铁律：品牌基因共享，布局各自定义。** 改颜色/字体/圆角去画廊改完同步过来。改间距/字号/组件尺寸在本项目改。
