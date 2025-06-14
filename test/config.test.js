import { test } from 'node:test';
import assert from 'node:assert';
import { CONFIG, BREAK_OVERRIDES } from '../src/config.js';

test('CONFIG has required properties', () => {
  assert.strictEqual(typeof CONFIG.PDF_FILE, 'string');
  assert.strictEqual(typeof CONFIG.PDF_DPI, 'number');
  assert.strictEqual(typeof CONFIG.PAGE_START, 'number');
  assert.strictEqual(typeof CONFIG.PAGE_END, 'number');
  assert.strictEqual(typeof CONFIG.OUTPUT_DIR, 'string');
  
  assert.ok(CONFIG.LEFT_COLUMN);
  assert.ok(CONFIG.RIGHT_COLUMN);
  assert.strictEqual(typeof CONFIG.Y_OFFSET, 'number');
  assert.strictEqual(typeof CONFIG.BREAK_THRESHOLD, 'number');
});

test('BREAK_OVERRIDES is a valid Map-like object', () => {
  assert.ok(typeof BREAK_OVERRIDES === 'object');
  assert.ok(BREAK_OVERRIDES['022-l'] instanceof Set);
  assert.ok(BREAK_OVERRIDES['022-l'].has(118));
});

test('Page range is valid', () => {
  assert.ok(CONFIG.PAGE_START >= 1);
  assert.ok(CONFIG.PAGE_END > CONFIG.PAGE_START);
  assert.strictEqual(CONFIG.PAGE_START, 16);
  assert.strictEqual(CONFIG.PAGE_END, 102);
});