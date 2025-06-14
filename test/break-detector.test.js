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

test('detectBreaks handles basic pixel data', () => {
  // Mock pixel data for a 2x3 image (RGB, 3 channels)
  // Row 0: all white
  // Row 1: all black
  // Row 2: all white
  const white = [255, 255, 255];
  const black = [0, 0, 0];

  const pixelData = Buffer.from([
    ...white, ...white, // Row 0
    ...black, ...black, // Row 1
    ...white, ...white  // Row 2
  ]);

  const info = { width: 2, height: 3, channels: 3 };
  const pageNum = 1;
  const column = 'l';

  // Temporarily set a low threshold for this small test
  const originalThreshold = detector.threshold;
  detector.threshold = 0;

  const result = detector.detectBreaks(pixelData, info, pageNum, column);
  
  assert.ok(Array.isArray(result));
  // Expecting a break after the black row, dividing into two regions:
  // [0, 1] (row 0) and [1, 3] (rows 1 and 2, because row 1 is not white and row 2 is white, state changes)
  // With threshold 0, it means any non-empty row after an empty start should mark a new block.
  // The first block starts at 0 (white). The second row (black) means the first block ends at 1.
  // The second block starts at 1. The third row (white) continues it.
  // So, expected: [[0, 1], [1, 3]]
  assert.deepStrictEqual(result, [[0, 1], [1, 3]]);

  // Reset threshold
  detector.threshold = originalThreshold;
});

test('isRowEmpty correctly identifies white/non-white rows', () => {
  const white = [255, 255, 255];
  const grey = [100, 100, 100];
  const black = [0, 0, 0];
  const red = [255, 0, 0];

  // 1x3 image, 3 channels (RGB)
  const pixelBuffer = Buffer.from([
    ...white, // Row 0 (White)
    ...grey,  // Row 1 (Grey)
    ...red    // Row 2 (Red)
  ]);
  const width = 1;
  const channels = 3;

  assert.strictEqual(detector.isRowEmpty(pixelBuffer, 0, width, channels), true, 'Row 0 should be empty (white)');
  assert.strictEqual(detector.isRowEmpty(pixelBuffer, 1, width, channels), false, 'Row 1 should not be empty (grey)');
  assert.strictEqual(detector.isRowEmpty(pixelBuffer, 2, width, channels), false, 'Row 2 should not be empty (red)');
});

test('threshold is set correctly', () => {
  assert.strictEqual(detector.threshold, 42);
});