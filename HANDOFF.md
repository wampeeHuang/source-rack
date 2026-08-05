# HANDOFF — 2026-08-05

## 项目状态

Source Rack 分类体系迁移完成。二级标签全覆盖（未细分 136→0），agent 写入门禁已建立，check.js 闸门全部通过。

## 本次完成

- **二级标签全量补齐** — domain-registry.js 新增 PRIMARY_HINT_SECONDARY（旧一级→二级推断），扩展 SECONDARY_REGISTRY 跨域覆盖，新增 SECONDARY_NORM 'IP管理→云服务'。未细分 136→0
- **zto.com 数据修正** — domains `["工具","招聘网站"]` → `["电商","支付物流"]`
- **URL 去重** — 删除 mp-weixin-qq-com.md（与 公众号.md 重复），check.js 闸门全部通过
- **filter-test.js** — 132 项测试全部通过（新增 §12 PRIMARY_HINT_SECONDARY 推断、§13 二级全覆盖）
- **validate.js** — 593/593，0 错误，0 未细分

## 当前数据

| 项目 | 值 |
|------|-----|
| 源总数 | 593 |
| 一级分布 | AI:254, 设计:137, 电商:73, 开发工具:58, 内容平台:31, 商业:22, 知识库:18 |
| 跨组源 | 56 |
| 未细分 | 0 (从 136→0) |
| filter-test.js | 132/132 |
| validate.js | 593/593 (0 错误) |
| check.js | 18/20 (闸门全过) |

## domain-registry.js 改动摘要

- **PRIMARY_HINT_SECONDARY** — 旧一级标签可推断二级（建筑→建筑与景观、代码→代码助手等 15 条）
- **SECONDARY_REGISTRY 扩展** — AI 加 代码托管/API/通用搜索/技术社区/社交平台/自动化工具/效率工具；开发工具 加 开发平台/UI/UX/设计工具/技术社区/文档手册；内容平台 加 资讯/设计工具；设计 加 社交平台/图书档案/电商服务；知识库 加 设计灵感
- **SECONDARY_NORM** — IP管理→云服务

## Agent 写源流程

任何 agent 进 `D:\workspace\source-rack\` → 读 CLAUDE.md → 四步写入：
1. `node -e "require('./domain-registry')"` 查合法标签
2. 按卡片格式写 .md 到 `D:\Obsidian\wiki\entities\sources\`
3. `node _review/validate.js` 验证分类
4. 刷新 `http://localhost:3098` 确认

## 已知提醒（非致命，非本次引入）

| 项目 | 说明 |
|------|------|
| tier 差异 | 文件 A:553/S:33/X:7 vs 服务器 A:554/S:32/X:7 — 差 1，非本次引入 |
| 未分档源 | 586/593 已分档（7 个无 tier） |
| POST /sources | 写入端点存在，需确认写入范围 |

## 待做

- decheng-landing-page .vercelignore 修复待提交那侧 git
