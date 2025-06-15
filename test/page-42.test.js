import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs';
import path from 'path';
import { GoetheBrListProcessor } from '../src/index.js';
import { CONFIG } from '../src/config.js';
import { fileExists } from '../src/utils/fs.js';

// Helper to get project root
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const projectRoot = path.resolve(__dirname, '..');

describe('Integration Test for Page 42', {
    // Longer timeout for processing a page, especially on slower machines or in CI
    timeout: 60000
}, () => {
    before(async (t) => {
        const pdfPath = path.join(projectRoot, CONFIG.PDF_FILE);
        if (!(await fileExists(pdfPath))) {
            t.skip(`SKIPPING TEST: PDF file not found at ${pdfPath}. Please download it first.`);
            return;
        }

        console.log('Setting up for test: processing page 42...');
        const processor = new GoetheBrListProcessor();
        // Clean up previous run's artifacts for page 42 to ensure a fresh run
        const pageFiles = [
            `042.csv`, `042.html`, `042-annot.png`,
            '042-l.json', '042-r.json', '042-l.txt', '042-r.txt'
        ];
        // Clean up all cropped images for the page
        for (let i = 0; i < 50; i++) {
            pageFiles.push(`042-l-${i}.png`);
            pageFiles.push(`042-r-${i}.png`);
        }
        
        for (const file of pageFiles) {
            try {
                await fs.unlink(path.join(projectRoot, CONFIG.OUTPUT_DIR, file));
            } catch (error) {
                if (error.code !== 'ENOENT') throw error; // ignore if file doesn't exist
            }
        }
        await processor.processPage(42);
    });

    test('should generate correct CSV content for page 42', async () => {
        const expectedCsvPath = path.join(projectRoot, 'test', 'fixtures', '042.csv');
        const actualCsvPath = path.join(projectRoot, CONFIG.OUTPUT_DIR, '042.csv');

        assert.ok(await fileExists(actualCsvPath), 'Generated CSV file for page 42 should exist');

        const expectedCsvContent = await fs.readFile(expectedCsvPath, 'utf8');
        const actualCsvContent = await fs.readFile(actualCsvPath, 'utf8');

        // Split into lines and ignore the first line (header with dynamic data)
        const expectedLines = expectedCsvContent.trim().split('\n').slice(1);
        const actualLines = actualCsvContent.trim().split('\n').slice(1);
        
        assert.deepStrictEqual(actualLines, expectedLines, "The body of the generated CSV for page 42 does not match the expected output.");
    });
});