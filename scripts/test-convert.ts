/**
 * Quick test for migrate-utils.ts timestamp conversion.
 * Run: npx tsx scripts/test-convert.ts
 */

import { convertGoTimeToEpoch, convertRow, formatProgress } from './migrate-utils';

let passed = 0;
let failed = 0;

function test(name: string, actual: any, expected: any) {
  if (actual === expected) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name} — expected ${expected}, got ${actual}`);
    failed++;
  }
}

console.log('Testing convertGoTimeToEpoch:');
test('ISO8601 Z', convertGoTimeToEpoch('2025-07-13T23:40:12Z'), 1752450012);
test('null', convertGoTimeToEpoch(null), null);
test('empty string', convertGoTimeToEpoch(''), null);
test('already integer', convertGoTimeToEpoch(1752450012), 1752450012);
test('ISO8601 2024-01-15', convertGoTimeToEpoch('2024-01-15T08:30:00Z'), 1705307400);
test('undefined', convertGoTimeToEpoch(undefined), null);
test('invalid date', convertGoTimeToEpoch('not-a-date'), null);

console.log('\nTesting convertRow:');
const row = {
  id: 1,
  created_at: '2025-07-13T23:40:12Z',
  updated_at: '2024-01-15T08:30:00Z',
  name: 'test',
};
const converted = convertRow(row, ['created_at', 'updated_at']);
test('convertRow created_at', converted.created_at, 1752450012);
test('convertRow updated_at', converted.updated_at, 1705307400);
test('convertRow name unchanged', converted.name, 'test');
test('convertRow id unchanged', converted.id, 1);

// Test with no timestamp columns
const noConvert = convertRow(row, []);
test('convertRow no columns', noConvert.created_at, '2025-07-13T23:40:12Z');

console.log('\nTesting formatProgress:');
test('formatProgress', formatProgress(15, 33, 'articles'), '[15/33] Migrating articles...');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
