import { test } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs'; 
import { ensureDir, fileExists, padPageNumber } from '../src/utils/fs.js';
import { join } from 'path';

test('padPageNumber formats correctly', () => {
  assert.strictEqual(padPageNumber(1), '001');
  assert.strictEqual(padPageNumber(16), '016');
  assert.strictEqual(padPageNumber(102), '102');
  assert.strictEqual(padPageNumber(999), '999');
});

test('fileExists returns false for non-existent file', async () => {
  const exists = await fileExists('/non/existent/file.txt');
  assert.strictEqual(exists, false);
});

test('ensureDir creates directories', async () => {
  const testDir = join(process.cwd(), 'test', 'tmp', 'nested', 'test.txt');
  
  // Clean up first
  try {
    await fs.rm(join(process.cwd(), 'test', 'tmp'), { recursive: true });
  } catch {}
  
  await ensureDir(testDir);
  
  const dirExists = await fileExists(join(process.cwd(), 'test', 'tmp', 'nested'));
  assert.strictEqual(dirExists, true);
  
  // Clean up
  await fs.rm(join(process.cwd(), 'test', 'tmp'), { recursive: true });
});