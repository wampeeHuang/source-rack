# HANDOFF — 2026-08-05

## 项目状态

v2.5 已归档冻结。准备 UI 重构（大改，不从现有 UI 改）。

## 归档信息

| 项目 | 值 |
|------|-----|
| 版本号 | **v2.5** |
| Git tag | `v2.5` |
| 归档分支 | `legacy-v2` |
| 恢复命令 | `git checkout legacy-v2` |
| UI 快照 | `_archive/v2.5-snapshot.html` (1MB 完整渲染) |
| 归档说明 | `_archive/README.md` |

## v2.5 数据

| 项目 | 值 |
|------|-----|
| 源总数 | 593 |
| 一级分布 | AI:254, 设计:137, 电商:73, 开发工具:58, 内容平台:31, 商业:22, 知识库:18 |
| 未细分 | 0 |
| validate.js | 593/593 |
| filter-test.js | 132/132 |
| check.js | 18/20 (闸门全过) |

## 重构注意事项

- **数据层不动** — domain-registry.js、Obsidian MD 文件、validate.js 保持不变
- **UI 层重写** — server.js 的 HTML 渲染部分替换
- **API 保持** — /health、/sources 等端点保留
- **回滚路径** — `git checkout legacy-v2` 即可回到当前版本

## 待做

- UI 重构方案设计
- decheng-landing-page .vercelignore 修复待提交那侧 git
