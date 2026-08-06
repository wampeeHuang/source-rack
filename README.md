# Source Rack — 信息源策展系统

**MD 文件即唯一真相源。** Markdown 文件 → 只读 Web 面板 → 自检闸门。

无数据库，无缓存，无后台冗余。文件是唯一的真相源，server.js 是只读投影。

## 快速开始

```bash
npm install
npm start        # http://localhost:3098
npm run check    # 跑自检闸门
```

## 文件结构

```
source-rack/
├── CLAUDE.md              ← AI 入口
├── server.js              ← 只读投影
├── domain-registry.js     ← 领域词表
├── references/            ← 规则文件（渐进披露）
├── scripts/               ← 闸门脚本
├── tokens/                ← 设计 token（品牌 + 布局）
├── public/                ← 前端静态资源
└── _runtime/              ← 会话临时文件
```

## 许可证

MIT
