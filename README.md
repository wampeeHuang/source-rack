# Source Rack · 信息源策展系统

> MD 文件即唯一真相源。Markdown 文件 → 只读 Web 面板 → 自检闸门。无数据库，无缓存，无后台冗余。

![Source Rack](screenshot.png)

文件是唯一的真相源，server.js 是只读投影。不是"另一个 CMS"——是让已有的 Markdown 文件可视化。

## 快速开始

```bash
npm install
npm start        # http://localhost:3098
npm run check    # 跑自检闸门
```

## 文件结构

```
source-rack/
├── CLAUDE.md              ← AI 入口 · 文件夹宪法
├── server.js              ← 只读投影
├── domain-registry.js     ← 领域词表
├── references/            ← 规则文件（渐进披露）
├── scripts/               ← 闸门脚本
├── assets/                ← 前端资源 + 设计令牌
└── _runtime/              ← 会话临时文件
```

## 设计哲学

### 文件是数据层，不是内容层
传统 CMS 把数据存数据库，文件是"内容"。Source Rack 反过来——Markdown 文件本身是结构化数据，server.js 只做只读投影。为什么？因为文件可以被 git 追踪、被 grep 搜索、被 AI agent 直接读写——数据库做不到这些。

### 自检闸门 = 质量合同
`npm run check` 跑 scripts/ 下的闸门脚本。exit 0 = 通过，exit 1 = 阻断。不是散文承诺——是可执行的验证。闸门脚本和 README 里的规则从同一份定义派生，永不漂移。

### 渐进式读取
CLAUDE.md 是路由，references/ 是详情，scripts/ 是执行。AI agent 按需加载——500 tokens 读完入口，需要时再深入。不在入口文件里堆所有规则。

## 诚实边界

- **策展系统，不是 CMS。** 不对文件做 CRUD——只读投影，不编辑源文件
- **依赖 Markdown 结构约定。** 文件必须遵从 CLAUDE.md 和 references/ 约定的格式，格式错误会导致面板显示异常
- **单用户设计。** 无权限系统、无多租户、无并发写入保护
- **不适合实时协作。** 文件变更后需手动刷新面板

## 许可证

MIT
