// Root fix: strip bm- prefix from remaining files.
// For each bm-*.md, derive clean name from URL (same logic as server POST /sources).
// If canonical already exists with same URL → merge tags + delete bm-.
// If canonical already exists with different URL → keep bm- (manual review needed).
// Usage:
//   node D:/projects/source-rack/rename-bm.js --dry-run    (preview only)
//   node D:/projects/source-rack/rename-bm.js              (execute renames)

var fs = require('fs');
var path = require('path');

var SOURCES_DIR = process.env.SOURCES_DIR || 'D:/Obsidian/wiki/entities/sources';
var DRY_RUN = process.argv.includes('--dry-run');

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
    var kv = lines[i].match(/^(\w+):\s*(.+)/);
    if (kv) {
      var val = kv[2].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map(function(s) { return s.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'); });
      }
      fields[kv[1]] = val;
    }
  }
  return { fields: fields, raw: raw, lines: lines, yamlStart: yamlStart, yamlEnd: yamlEnd };
}

var files = fs.readdirSync(SOURCES_DIR).filter(function(f) { return f.endsWith('.md'); });
var bmFiles = files.filter(function(f) { return f.startsWith('bm-'); });

console.log('bm- 前缀文件: ' + bmFiles.length + ' 个');
console.log('模式: ' + (DRY_RUN ? '--dry-run (仅预览)' : '执行重命名'));
console.log('');

var renamed = 0, merged = 0, skipped = 0;

bmFiles.forEach(function(bmFile) {
  var bmPath = path.join(SOURCES_DIR, bmFile);
  var cleanName = bmFile.replace(/^bm-/, '');
  if (cleanName === bmFile) { skipped++; return; } // shouldn't happen
  var cleanPath = path.join(SOURCES_DIR, cleanName);

  // Check if canonical already exists
  if (fs.existsSync(cleanPath)) {
    // Both files exist — compare URLs
    var bmData = readFields(bmPath);
    var canonData = readFields(cleanPath);
    var bmUrl = (bmData.fields.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    var canonUrl = (canonData.fields.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

    if (bmUrl === canonUrl) {
      // Same URL — merge tags from bm into canonical, then delete bm
      var canTags = (canonData.fields.tags && Array.isArray(canonData.fields.tags)) ? canonData.fields.tags.slice() : [];
      var bmTags = (bmData.fields.tags && Array.isArray(bmData.fields.tags)) ? bmData.fields.tags : [];
      var canTagSet = new Set(canTags);
      var newTags = bmTags.filter(function(t) { return !canTagSet.has(t); });

      if (newTags.length > 0) {
        var mergedTags = canTags.concat(newTags);
        var tagIdx = null;
        for (var i = canonData.yamlStart + 1; i < canonData.yamlEnd; i++) {
          if (canonData.lines[i].match(/^tags:/)) { tagIdx = i; break; }
        }
        var tagLine = 'tags: [' + mergedTags.map(function(t) { return '"' + t + '"'; }).join(', ') + ']';
        if (tagIdx) { canonData.lines[tagIdx] = tagLine; }
        else { canonData.lines.splice(canonData.yamlEnd, 0, tagLine); }
        console.log('合并: ' + bmFile + ' → ' + cleanName + '  tags: +' + newTags.join(', '));
      } else {
        console.log('删除: ' + bmFile + ' → ' + cleanName + ' 已存在 (同URL)');
      }
      if (!DRY_RUN) {
        fs.writeFileSync(cleanPath, canonData.lines.join('\n'), 'utf8');
        fs.unlinkSync(bmPath);
      }
      merged++;
    } else {
      skipped++;
      console.log('冲突: ' + bmFile + ' → ' + cleanName + ' 已存在 (不同URL)');
      console.log('  bm: ' + bmUrl + ' | 已有: ' + canonUrl);
    }
  } else {
    // Safe rename — strip prefix
    console.log('重命名: ' + bmFile + ' → ' + cleanName);
    if (!DRY_RUN) { fs.renameSync(bmPath, cleanPath); }
    renamed++;
  }
});

console.log('');
console.log('═══════════════════════════════════════');
console.log('总计 bm- 文件: ' + bmFiles.length);
console.log('重命名: ' + renamed + ' 个');
console.log('合并删除: ' + merged + ' 个');
console.log('跳过: ' + skipped + ' 个');
if (DRY_RUN) console.log('⚠ --dry-run, 未实际执行');
console.log('');
