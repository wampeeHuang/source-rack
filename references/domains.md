# 领域分类法

**一级领域**：`AI` `设计` `电商` `开发工具` `内容平台` `商业` `知识库`（7 个）

**二级领域**：每个一级下有闭合二级词表。

**合法标签全集**定义在 `domain-registry.js`（唯一真相源），运行以下命令查看：

```bash
node -e "const r = require('./domain-registry'); console.log(JSON.stringify({primary: r.PRIMARY_ORDER, oldTags: Object.keys(r.OLD_TO_NEW), secondary: r.SECONDARY_REGISTRY}, null, 2))"
```

标签修改只改 `domain-registry.js`，不改第二处。

## Agent 添加源流程

```
1. 读词表 → node -e "require('./domain-registry')" 查合法标签
2. 写文件 → 按卡片格式写 .md 到 D:/Obsidian/wiki/entities/sources/
3. 验证 → node scripts/check.js（确认分类正确）
4. 刷新 → http://localhost:3098 确认显示正常
```

**核心规则：**
- domains 标签必须来自 domain-registry.js 词表，不在词表的标签会被归一化为"未细分"
- 新源 tier 默认 A
- 文件名 = `{domain-name}.md`，从 URL 派生（`github-com.md`）
