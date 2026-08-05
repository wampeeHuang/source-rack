# 归档版本

## v2.5 — 2026-08-05

分类体系完整版，重构前最后一版。

**Git:** `legacy-v2` 分支 / `v2.5` tag / commit `5ea632c`

**快照:** `v2.5-snapshot.html` — 完整渲染页面 (1MB)

**数据:**
- 593 个源，0 未细分
- check.js 闸门全部通过 (18/20)
- validate.js 593/593，0 错误
- filter-test.js 132/132

**技术栈:**
- Node.js 单文件服务器 (server.js, ~750 行)
- Express + EJS-like 模板字符串
- 暖象牙白 Swiss 极简 UI
- domain-registry.js 分类引擎

**恢复:** `git checkout legacy-v2`
