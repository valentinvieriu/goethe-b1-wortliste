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

  // Create a new detector instance for this test to avoid side effects
  const testDetector = new BreakDetector();
  testDetector.threshold = 0;

  const result = testDetector.detectBreaks(pixelData, info, pageNum, column);
  
  assert.ok(Array.isArray(result));
  // With a simple 3-row image and threshold 0, the algorithm will identify one continuous block
  // because it starts in 'trail' state, finds content (black row), then continues until end
  assert.deepStrictEqual(result, [[0, 3]]);
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
  const freshDetector = new BreakDetector();
  assert.strictEqual(freshDetector.threshold, 42);
});