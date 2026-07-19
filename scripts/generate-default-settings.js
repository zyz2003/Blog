/**
 * Generate default-settings.ts from Go definition.go
 * Run: node scripts/generate-default-settings.js
 */
const fs = require('fs');
const path = require('path');

const goDefPath = path.join(__dirname, '..', '_go-backend-archive', 'internal', 'configdef', 'definition.go');
const goConstPath = path.join(__dirname, '..', '_go-backend-archive', 'pkg', 'constant', 'setting.go');
const outPath = path.join(__dirname, '..', 'server', 'src', 'settings', 'default-settings.ts');

const goDef = fs.readFileSync(goDefPath, 'utf8');
const goConst = fs.readFileSync(goConstPath, 'utf8');

// Build constant map: KeyXxx -> string value
const constMap = {};
const constRegex = /Key(\w+)\s+SettingKey\s*=\s*"([^"]+)"/g;
let m;
while ((m = constRegex.exec(goConst)) !== null) {
  constMap['Key' + m[1]] = m[2];
}

/**
 * Parse a Go string literal (backtick or double-quoted) starting at position i.
 * Handles:
 *   - Backtick strings: `...` (no escape sequences, can span multiple lines)
 *   - Double-quoted strings: "..." (with escape sequences like \n, \", \\)
 *   - String concatenation: str1 + str2 + str3 (combines adjacent strings)
 *
 * Returns { value: string, endPos: number } or null if not a string.
 */
function parseGoString(src, i) {
  let value = '';
  let pos = i;

  while (pos < src.length) {
    // Skip whitespace between concatenated parts
    while (pos < src.length && /\s/.test(src[pos])) pos++;
    if (pos >= src.length) break;

    if (src[pos] === '`') {
      // Backtick string: read until closing backtick
      const start = pos + 1;
      const end = src.indexOf('`', start);
      if (end === -1) return null;
      value += src.substring(start, end);
      pos = end + 1;
    } else if (src[pos] === '"') {
      // Double-quoted string: handle escape sequences
      pos++;
      let str = '';
      while (pos < src.length && src[pos] !== '"') {
        if (src[pos] === '\\' && pos + 1 < src.length) {
          const next = src[pos + 1];
          if (next === 'n') { str += '\n'; pos += 2; }
          else if (next === 't') { str += '\t'; pos += 2; }
          else if (next === '\\') { str += '\\'; pos += 2; }
          else if (next === '"') { str += '"'; pos += 2; }
          else { str += src[pos]; pos++; }
        } else {
          str += src[pos];
          pos++;
        }
      }
      if (pos < src.length) pos++; // skip closing quote
      value += str;
    } else {
      // Not a string start — stop concatenation
      break;
    }

    // Check for + operator (string concatenation)
    while (pos < src.length && /\s/.test(src[pos])) pos++;
    if (pos < src.length && src[pos] === '+') {
      pos++;
      // Continue to next string part
    } else {
      break;
    }
  }

  return value.length > 0 || src[i] === '`' || src[i] === '"' ? { value, endPos: pos } : null;
}

/**
 * Parse all definition entries from Go source using a character-level parser.
 * This correctly handles multiline backtick values and string concatenation.
 */
function parseDefinitions(src) {
  const entries = [];
  const pattern = '{Key: constant.';
  let searchFrom = 0;

  while (true) {
    const entryStart = src.indexOf(pattern, searchFrom);
    if (entryStart === -1) break;

    let pos = entryStart + pattern.length;

    // Parse constant name (KeyXxx)
    const nameStart = pos;
    while (pos < src.length && /[\w]/.test(src[pos])) pos++;
    const constName = src.substring(nameStart, pos);

    // Skip ", Value: "
    if (!src.substring(pos).match(/^\s*,\s*Value\s*:\s*/)) { searchFrom = pos; continue; }
    pos = pos + src.substring(pos).match(/^\s*,\s*Value\s*:\s*/)[0].length;

    // Parse Value (Go string with possible concatenation)
    const valueResult = parseGoString(src, pos);
    if (!valueResult) { searchFrom = pos; continue; }
    const value = valueResult.value;
    pos = valueResult.endPos;

    // Skip ", Comment: "
    const commentMatch = src.substring(pos).match(/^\s*,\s*Comment\s*:\s*/);
    if (!commentMatch) { searchFrom = pos; continue; }
    pos = pos + commentMatch[0].length;

    // Parse Comment (Go string)
    const commentResult = parseGoString(src, pos);
    if (!commentResult) { searchFrom = pos; continue; }
    const comment = commentResult.value;
    pos = commentResult.endPos;

    // Skip ", IsPublic: "
    const isPublicMatch = src.substring(pos).match(/^\s*,\s*IsPublic\s*:\s*/);
    if (!isPublicMatch) { searchFrom = pos; continue; }
    pos = pos + isPublicMatch[0].length;

    // Parse IsPublic (true/false)
    const isPublic = src.substring(pos).startsWith('true');
    pos += isPublic ? 4 : 5;

    // Skip closing }
    while (pos < src.length && src[pos] !== '}') pos++;
    pos++;

    const key = constMap[constName];
    if (key) {
      entries.push({ key, value, comment, isPublic });
    }

    searchFrom = pos;
  }

  return entries;
}

const defaults = parseDefinitions(goDef);

// Generate TypeScript file using JSON.stringify for safe escaping
const lines = [
  '/**',
  ' * Default settings seeded on first startup.',
  ` * Extracted from Go internal/configdef/definition.go — ${defaults.length} entries.`,
  ' * Generated by scripts/generate-default-settings.js — do not edit manually.',
  ' */',
  'export const DEFAULT_SETTINGS: Array<{ key: string; value: string; comment: string }> = [',
];

for (const d of defaults) {
  const keyJ = JSON.stringify(d.key);
  const valueJ = JSON.stringify(d.value);
  const commentJ = JSON.stringify(d.comment);
  lines.push(`  { key: ${keyJ}, value: ${valueJ}, comment: ${commentJ} },`);
}

lines.push('];');

fs.writeFileSync(outPath, lines.join('\n'));
console.log(`Generated ${outPath} with ${defaults.length} entries`);
