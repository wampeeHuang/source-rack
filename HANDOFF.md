# HANDOFF — 2026-08-05

## 当前状态

v3.0 可视化完成。服务器运行中: `http://localhost:3098/`

## 架构

```
tokens/brand.css    — 品牌基因（画廊投影，不改）
tokens/layout.css   — 布局 token（字号/间距/组件）
public/app.css      — 应用样式（零裸值，只用 var(--token)）
public/app.js       — 客户端逻辑（筛选/排序/健康/点击）
server.js           — 779行，HTML模板 + API 端点
```

## 已做

- [x] 单体拆分为 token+CSS+JS 四层
- [x] CSP 收紧 style-src 'self'（零行内样式）
- [x] 架构图回归（5节点流动图，品牌绿）
- [x] Footer 全宽贴边
- [x] 字号抬升（text-base 13→15px）
- [x] 筛选标签改名（一级→领域，二级→子领域）
- [x] 页面宽度 1400→1800px
- [x] CSS Grid 行溢出修复（height→min-height）
- [x] 已 commit: `ffaeb19`

## 已知问题

1. **字体** — 本机有 Noto Sans/Serif SC 所以正常。没装的中文 Windows 会回退到 SimSun/YaHei，品牌感丢失。长线解法：@font-face 或国内 CDN
2. **script-src 'unsafe-inline'** — chip onclick 需要。改成 JS 事件委托后可去掉
3. **移动端** — 未做响应式

## 相关文件

- 复盘: `D:\workspace\_output\retrospectives\2026-08-05-source-rack-ui-v3.md`
- Tips: `css-grid-row-fixed-height-overflow.md` + `csp-style-src-self-blocks-inline.md`
- 归档: `_archive/v3.0-snapshot.html`
