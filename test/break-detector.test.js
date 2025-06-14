import { test } from 'node:test';
import assert from 'node:assert';
import { BreakDetector } from '../src/processors/break-detector.js';

const detector = new BreakDetector();

test('processOverrides creates ranges from set', () => {
  const overrideSet = new Set([100, 200, 300]);
  const result = detector.processOverrides(overrideSet);
  
  assert.deepStrictEqual(result, [
    [0, 100],
    [100, 200], 
    [200, 300]
  ]);
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