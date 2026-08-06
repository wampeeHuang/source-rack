# 维护规则（踩坑记录）

## 服务部署

- **启动必须用绝对路径**：`node D:/workspace/source-rack/server.js`
- `cd D:/projects/source-rack && node server.js &` 在后台进程中 CWD 可能不生效
- 修改 server.js 后必须手动重启才能生效（无热重载）

## 字段兼容

- 旧 Chrome 书签导入使用 `created:` / `updated:` 而非 `added:` / `last_used:`
- `scanSources()` 的 `norm()` 负责标准化映射。新增字段名时必须同步更新该函数
- 面板排序、stale 检测、POST /sources/touch 均依赖 `added` 和 `last_used`

## CSS 规则

- `.tier-x` = X 档红色警示线，禁止重复定义
- `.src-url` = 品牌主色，不能用灰色——灰色看起来像失效链接
- `row.stale` = `opacity: 0.5`，stale 检测门限 > 90 天 + 无 `last_used`
- **flex/grid 容器必须写 `[hidden]` 回退**：`display: flex` 覆盖浏览器默认 `[hidden] { display: none }`，必须加 `.container[hidden] { display: none !important }`。踩坑：图谱视图漏到列表模式

## JS 规则

- **高频渲染禁 innerHTML**：rAF 循环中用 `innerHTML` 重建 DOM 会吃掉 click 事件（mousedown 到 mouseup 之间元素已销毁）。用 `setAttribute` 更新属性，或在 mousedown 阶段捕获意图数据
