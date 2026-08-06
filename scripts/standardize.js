// Source Rack — batch standardize all MD files to meet spec
// 修复: why字段、URL裸域名、域名重复标签、type字段、added日期
// 安全策略: 原地修改目标行，不动其他任何字段
// Usage:
//   node D:/projects/source-rack/standardize.js --dry-run     (preview only)
//   node D:/projects/source-rack/standardize.js               (apply changes)

const fs = require('fs');
const path = require('path');

const SOURCES_DIR = process.env.SOURCES_DIR || 'D:/Obsidian/wiki/entities/sources';
const DRY_RUN = process.argv.includes('--dry-run');

const DOMAIN_ORDER = ['AI', '设计', '电商', '工具', '开发', '前端', '产品', '写作', '学习', '社区', '媒体', '参考', '搜索', '商业'];

function escYaml(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
function parseYamlLine(line) {
  var kv = line.match(/^(\w+):\s*(.+)/);
  if (!kv) return null;
  var key = kv[1], val = kv[2].trim();
  if (val.startsWith('[') && val.endsWith(']')) {
    val = val.slice(1, -1).split(',').map(function(s) { return s.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'); });
  } else {
    val = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
  return { key: key, value: val, raw: kv[2] };
}

function generateWhy(domains, sourceType, title) {
  var primary = (domains || []).find(function(d) { return DOMAIN_ORDER.includes(d); }) || (domains||[])[0] || '';
  var secondary = (domains || []).find(function(d) { return !DOMAIN_ORDER.includes(d) && d !== primary; }) || '';
  var domainLabel = secondary ? primary + '·' + secondary : primary;
  if (domainLabel && sourceType) return domainLabel + ' ' + sourceType;
  if (sourceType) return sourceType + ' 来源';
  return (title || '') + ' 信息源';
}

// In-place fix a single file. Returns array of change descriptions, or null if no changes.
function fixFile(filePath, fname) {
  var raw = fs.readFileSync(filePath, 'utf8');
  var lines = raw.split('\n');
  var changes = [];

  // Find YAML block
  var yamlStart = -1, yamlEnd = -1;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (yamlStart === -1) yamlStart = i;
      else { yamlEnd = i; break; }
    }
  }
  if (yamlStart === -1 || yamlEnd === -1) return null; // no valid YAML

  // Parse existing fields
  var fields = {};
  var fieldIndices = {};
  for (var i = yamlStart + 1; i < yamlEnd; i++) {
    var parsed = parseYamlLine(lines[i]);
    if (parsed) { fields[parsed.key] = parsed.value; fieldIndices[parsed.key] = i; }
  }

  // ── Fix 1: add/restore `added` field if missing ──
  if (!fields.added) {
    var dateVal = fields.created || '2026-06-04';
    if (typeof dateVal === 'string') dateVal = dateVal.replace(/^"(.*)"$/, '$1');
    var addedLine = 'added: ' + dateVal;
    // Insert before `type:` or before closing `---`
    var insertIdx = fieldIndices['type'] || yamlEnd;
    if (fieldIndices['type']) {
      lines.splice(insertIdx, 0, addedLine);
      changes.push('补 added: ' + dateVal);
    } else {
      lines.splice(yamlEnd, 0, addedLine);
      changes.push('补 added: ' + dateVal);
    }
    // Shift all subsequent indices
    for (var k in fieldIndices) {
      if (fieldIndices[k] >= insertIdx) fieldIndices[k]++;
    }
    yamlEnd++;
  }

  // ── Fix 2: add `why` field if missing ──
  if (!fields.why) {
    var domains = Array.isArray(fields.domains) ? fields.domains : [];
    var stype = typeof fields.source_type === 'string' ? fields.source_type : '';
    var title = typeof fields.title === 'string' ? fields.title : fname;
    var whyVal = generateWhy(domains, stype, title);
    var whyLine = 'why: ' + escYaml(whyVal);
    var insertIdx = fieldIndices['added'] || yamlEnd;
    lines.splice(insertIdx, 0, whyLine);
    changes.push('补 why: ' + whyVal);
    for (var k in fieldIndices) {
      if (fieldIndices[k] >= insertIdx) fieldIndices[k]++;
    }
    yamlEnd++;
    fields.why = whyVal;
    fieldIndices.why = insertIdx;
  }

  // ── Fix 3: fix bare-domain URLs ──
  if (typeof fields.url === 'string' && !/^https?:\/\//i.test(fields.url) && !/^file:\/\//i.test(fields.url)) {
    var u = fields.url.trim();
    if (!/^(localhost|127\.\d+\.\d+\.\d+|\[\:\:1\]|[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/i.test(u)) {
      var oldUrl = fields.url;
      var newUrl = 'https://' + u;
      var urlIdx = fieldIndices['url'];
      if (urlIdx) {
        lines[urlIdx] = 'url: ' + newUrl;
        changes.push('url: ' + oldUrl + ' → ' + newUrl);
      }
    }
  }

  // ── Fix 4: change type: entity → source ──
  if (fields.type === 'entity') {
    var typeIdx = fieldIndices['type'];
    if (typeIdx) {
      lines[typeIdx] = 'type: source';
      changes.push('type: entity → source');
    }
  }

  // ── Fix 5: clean domain-duplicate tags ──
  if (Array.isArray(fields.tags) && Array.isArray(fields.domains)) {
    var domainSet = new Set(fields.domains);
    var cleanTags = fields.tags.filter(function(t) { return !domainSet.has(t); });
    cleanTags = cleanTags.filter(function(t) { return t && t.length > 0; });
    if (cleanTags.length === 0) cleanTags = ['reference'];
    var tagsChanged = cleanTags.length !== fields.tags.length ||
      cleanTags.join(',') !== fields.tags.join(',');
    if (tagsChanged) {
      var tagsIdx = fieldIndices['tags'];
      if (tagsIdx) {
        var tagsLine = 'tags: [' + cleanTags.map(function(t) { return '"' + t + '"'; }).join(', ') + ']';
        lines[tagsIdx] = tagsLine;
        changes.push('tags: [' + fields.tags.join(', ') + '] → [' + cleanTags.join(', ') + ']');
      }
    }
  }

  if (changes.length === 0) return null;

  var output = lines.join('\n');
  if (!DRY_RUN) {
    fs.writeFileSync(filePath, output, 'utf8');
  }
  return changes;
}

// ─── Main ───
var files = fs.readdirSync(SOURCES_DIR).filter(function(f) { return f.endsWith('.md'); });
var stats = { total: files.length, changed: 0, unchanged: 0, changeTypes: {} };

console.log('Source Rack · 批量标准化');
console.log('目录: ' + SOURCES_DIR);
console.log('文件: ' + files.length + ' 个');
console.log('模式: ' + (DRY_RUN ? '--dry-run (仅预览)' : '执行修改'));
console.log('安全: 原地修改，只动目标行\n');

files.forEach(function(fname) {
  var filePath = path.join(SOURCES_DIR, fname);
  var changes = fixFile(filePath, fname);
  if (changes) {
    stats.changed++;
    console.log(fname);
    changes.forEach(function(c) {
      console.log('  ' + c);
      var t = c.split(':')[0];
      stats.changeTypes[t] = (stats.changeTypes[t] || 0) + 1;
    });
  } else {
    stats.unchanged++;
  }
});

console.log('');
console.log('═══════════════════════════════════════');
console.log('总计: ' + stats.total + ' 个文件');
console.log('已修改: ' + stats.changed + ' 个');
Object.keys(stats.changeTypes).forEach(function(k) {
  console.log('  - ' + k + ': ' + stats.changeTypes[k]);
});
console.log('未修改: ' + stats.unchanged + ' 个');
console.log('');

if (DRY_RUN) {
  console.log('⚠  --dry-run 模式，以上变更未实际写入。');
  console.log('   确认无误后执行: node D:/projects/source-rack/standardize.js');
} else {
  console.log('✓ 变更已写入。验证: node D:/projects/source-rack/check.js');
}
