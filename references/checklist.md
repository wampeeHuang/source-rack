# 门禁清单

## 每次提交前

- [ ] `node scripts/check.js` → exit 0（闸门全过）
- [ ] `grep -rP "聚合源|AI原生" D:/Obsidian/wiki/entities/sources/ | grep "^why:"` → 0 matches（无模板描述）
- [ ] `curl -s http://localhost:3098/` → 页面正常加载，无 CSP 报错

## 新源收录前

- [ ] domains 在 `domain-registry.js` 词表内
- [ ] why 非模板，手写一句话（禁止 "{域}·{子域} 聚合源/AI原生/社区" 格式）
- [ ] URL 完整 `https://`
- [ ] 文件名 = `{domain-name}.md`，无 `bm-` 前缀

## 品牌变更后

- [ ] `tokens/brand.css` 与画廊 `brand.json` 一致
- [ ] 页面无裸色值：`grep -rP '#[0-9a-fA-F]{3,6}' public/app.css` → 无匹配

## 架构变更后

- [ ] `node server.js` 启动无报错
- [ ] `curl -s http://localhost:3098/health` → total 与文件系统一致
- [ ] 架构图正常渲染（`references/architecture.svg` 存在且页面可见）
- [ ] `node scripts/check.js` → 20+ 项检查全部通过

## 门禁级别

| 级别 | 触发条件 | 含义 | 操作 |
|------|---------|------|------|
| 🔴 闸门拦截 | 重复URL / 缺URL / 非法枚举值 | 真相源被破坏 | `node scripts/check.js` 定位 → 修复 → 重启 |
| 🟡 提醒 | 缺档位 / 缺类型 / 缺领域 | 元数据不完整 | `node scripts/standardize.js --dry-run` 预览 → 执行 |
| 🟢 通过 | 全部7项通过 | 唯一真相源完整自洽 | 无需操作 |

7 项原子检查（`scripts/check.js` 实现）：
1. 文件总数 — 服务端计数
2. URL 无重复 — 每个 URL 唯一
3. URL 无缺失 — 每个文件有 url
4. 档位无缺失 — 每个文件有 tier
5. 类型无缺失 — 每个文件有 source_type
6. 领域无缺失 — 每个文件有 domains
7. 枚举值合法 — tier ∈ {S,A,X}，source_type ∈ 合法集
