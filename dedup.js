// Deduplicate bm- prefix files that share URLs with properly-named files.
// For each pair: keep canonical (non-bm), merge unique tags, delete bm-.
// Usage: node D:/projects/source-rack/dedup.js --dry-run | node D:/projects/source-rack/dedup.js

const fs = require('fs');
const path = require('path');

const SOURCES_DIR = process.env.SOURCES_DIR || 'D:/Obsidian/wiki/entities/sources';
const DRY_RUN = process.argv.includes('--dry-run');

function parseYamlLine(line) {
  var kv = line.match(/^(\w+):\s*(.+)/);
  if (!kv) return null;
  var key = kv[1], val = kv[2].trim();
  if (val.startsWith('[') && val.endsWith(']')) {
    return { key: key, value: val.slice(1, -1).split(',').map(function(s) { return s.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'); }), isArray: true };
  }
  return { key: key, value: val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1') };
}

function readFields(filePath) {
  var raw = fs.readFileSync(filePath, 'utf8');
  var lines = raw.split('\n');
  var fields = {};
  var yamlStart = -1, yamlEnd = -1;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (yamlStart === -1) yamlStart = i;
      else { yamlEnd = i; break; }
    }
  }
  for (var i = yamlStart + 1; i < yamlEnd; i++) {
    var p = parseYamlLine(lines[i]);
    if (p) fields[p.key] = { value: p.value, lineIdx: i, isArray: p.isArray };
  }
  return { fields: fields, raw: raw, lines: lines, yamlStart: yamlStart, yamlEnd: yamlEnd };
}

// Find all URL-based duplicates
var files = fs.readdirSync(SOURCES_DIR).filter(function(f) { return f.endsWith('.md'); });
var urlMap = {};
files.forEach(function(f) {
  var fp = path.join(SOURCES_DIR, f);
  var raw = fs.readFileSync(fp, 'utf8');
  var m = raw.match(/^url:\s*(.+)$/m);
  if (!m) return;
  var url = m[1].trim().replace(/^"(.*)"$/, '$1').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
  if (!urlMap[url]) urlMap[url] = [];
  urlMap[url].push(f);
});

var dupGroups = Object.entries(urlMap).filter(function(e) { return e[1].length > 1; });

console.log('去重: ' + dupGroups.length + ' 组重复');
console.log('模式: ' + (DRY_RUN ? '--dry-run' : '执行删除'));
console.log('');

var deleted = 0, merged = 0;

dupGroups.forEach(function(group) {
  var url = group[0];
  var fnames = group[1];
  var bmFiles = fnames.filter(function(f) { return f.startsWith('bm-'); });
  var goodFiles = fnames.filter(function(f) { return !f.startsWith('bm-'); });

  if (goodFiles.length === 0) {
    console.log('跳过: ' + fnames.join(', ') + ' (全是 bm- 文件，无规范命名)');
    return;
  }

  var canonical = goodFiles[0];
  var canonicalPath = path.join(SOURCES_DIR, canonical);
  var canonicalData = readFields(canonicalPath);

  bmFiles.forEach(function(bmFile) {
    var bmPath = path.join(SOURCES_DIR, bmFile);
    var bmData = readFields(bmPath);

    // Merge unique tags from bm into canonical
    var canTags = (canonicalData.fields.tags && canonicalData.fields.tags.value) || [];
    var bmTags = (bmData.fields.tags && bmData.fields.tags.value) || [];
    if (!Array.isArray(canTags)) canTags = [];
    if (!Array.isArray(bmTags)) bmTags = [];

    var canTagSet = new Set(Array.isArray(canTags) ? canTags : []);
    var newTags = bmTags.filter(function(t) { return !canTagSet.has(t); });

    if (newTags.length > 0) {
      // Merge tags into canonical file
      var tagIdx = canonicalData.fields.tags ? canonicalData.fields.tags.lineIdx : null;
      var mergedTags = (Array.isArray(canTags) ? canTags : []).concat(newTags);
      var tagLine = 'tags: [' + mergedTags.map(function(t) { return '"' + t + '"'; }).join(', ') + ']';

      if (tagIdx) {
        canonicalData.lines[tagIdx] = tagLine;
      } else {
        // Insert before closing ---
        canonicalData.lines.splice(canonicalData.yamlEnd, 0, tagLine);
      }

      console.log('合并: ' + bmFile + ' → ' + canonical + '  tags: +' + newTags.join(', '));
      merged++;
    } else {
      console.log('删除: ' + bmFile + ' (无独有数据)');
    }

    if (!DRY_RUN) {
      // Write canonical with merged tags
      fs.writeFileSync(canonicalPath, canonicalData.lines.join('\n'), 'utf8');
      // Delete bm file
      fs.unlinkSync(bmPath);
      deleted++;
    }
  });
});

console.log('');
console.log('═══════════════════════════════════════');
console.log('去重组: ' + dupGroups.length);
console.log('合并标签: ' + merged + ' 处');
console.log('删除文件: ' + deleted + ' 个');
if (DRY_RUN) console.log('⚠ --dry-run, 未实际执行');
