import { test } from 'node:test';
import assert from 'node:assert';
import { BreakDetector } from '../src/processors/break-detector.js';

const detector = new BreakDetector();

test('BREAK_OVERRIDES contains expected page overrides', async () => {
  const { BREAK_OVERRIDES } = await import('../src/config.js');
  
  // Test that specific overrides exist
  assert.ok(BREAK_OVERRIDES['042-l']);
  assert.ok(BREAK_OVERRIDES['042-l'].has(2728));
  assert.ok(BREAK_OVERRIDES['022-l'].has(118));
});

test('parseXMP handles basic XMP format', () => {
  const xmpContent = `/* XPM */
static char *test[] = {
"2 3 2 1",
"a c white",
"b c black", 
/* pixels */
"aa",
"bb",
"aa",
};`;

  const result = detector.parseXMP(xmpContent);
  
  // Should detect break at line 1 (the "bb" line creates a break)
  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
});

test('threshold is set correctly', () => {
  assert.strictEqual(detector.threshold, 42);
});