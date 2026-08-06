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
