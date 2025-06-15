#!/usr/bin/env node

import { promises as fs } from 'fs';
import { cpus } from 'os';
import { CONFIG } from './config.js';
import { PDFConverter } from './processors/pdf-converter.js';
import { PageProcessor } from './processors/page-processor.js';
import { DataProcessor } from './processors/data-processor.js';
import { fileExists } from './utils/fs.js';

export class GoetheBrListProcessor {
  constructor() {
    this.pdfConverter = new PDFConverter();
    this.pageProcessor = new PageProcessor();
    this.dataProcessor = new DataProcessor();
  }

  /**
   * Execute an async iterator over an array of items while keeping at most
   * `limit` promises running concurrently.
   *
   * @template T
   * @param {T[]} items              Items to iterate over
   * @param {number} limit           Maximum concurrent executions
   * @param {(item:T)=>Promise<void>} iteratorFn  Work to perform per item
   */
  async runWithConcurrency(items, limit, iteratorFn) {
    const executing = [];
    for (const item of items) {
      const p = Promise.resolve().then(() => iteratorFn(item));
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);
  }

  /**
   * Process the whole Wortliste (pages 16 – 102) in parallel.
   * Concurrency is capped at the number of detected CPU cores.
   */
  async processAll() {
    console.log('Starting Goethe B1 Wortliste processing...');

    // Check if PDF exists
    if (!(await fileExists(CONFIG.PDF_FILE))) {
      const message = `PDF file not found: ${CONFIG.PDF_FILE}\nGet yourself Goethe-Zertifikat_B1_Wortliste.pdf\nIt used to live at https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf`;
      throw new Error(message);
    }

    // Ensure output directory exists
    await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });

    // Render PNGs if necessary
    await this.pdfConverter.convertPDFToPNG();

    const cpuCount = Math.max(1, cpus().length);
    console.log(`Processing pages in parallel (concurrency = ${cpuCount})…`);

    const pageNumbers = [];
    for (let p = CONFIG.PAGE_START; p <= CONFIG.PAGE_END; p++) pageNumbers.push(p);

    let allRawData = [];

    await this.runWithConcurrency(pageNumbers, cpuCount, async (pageNum) => {
      try {
        await this.pageProcessor.processPage(pageNum);

        // Aggregate raw data for the combined HTML/CSV
        const paddedPage = pageNum.toString().padStart(3, '0');
        const leftFile  = `${CONFIG.OUTPUT_DIR}/${paddedPage}-l.json`;
        const rightFile = `${CONFIG.OUTPUT_DIR}/${paddedPage}-r.json`;

        if (await fileExists(leftFile)) {
          const leftData = JSON.parse(await fs.readFile(leftFile, 'utf8'));
          allRawData = this.dataProcessor.processRawData(leftData, allRawData);
        }
        if (await fileExists(rightFile)) {
          const rightData = JSON.parse(await fs.readFile(rightFile, 'utf8'));
          allRawData = this.dataProcessor.processRawData(rightData, allRawData);
        }
      } catch (err) {
        console.error(`Error processing page ${pageNum}:`, err.message);
      }
    });

    // Produce combined output
    console.log('Generating final combined files…');
    await this.generateCombinedOutputs(allRawData);

    console.log('Processing completed successfully!');
  }

  async processPage(pageNum) {
    console.log(`Processing single page: ${pageNum}`);

    // Check if PDF exists
    if (!(await fileExists(CONFIG.PDF_FILE))) {
      throw new Error(`PDF file not found: ${CONFIG.PDF_FILE}`);
    }

    // Ensure output directory exists
    await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });

    // Convert PDF to PNG if needed
    await this.pdfConverter.convertPDFToPNG();

    // Process the specific page
    await this.pageProcessor.processPage(pageNum);
    console.log(`Page ${pageNum} processed successfully!`);
  }

  async generateCombinedOutputs(allRawData) {
    const processedData = await this.dataProcessor.processExtractedData(allRawData);
    const html = await this.dataProcessor.generateHTML(processedData, 'all');
    const csv  = await this.dataProcessor.generateCSV(processedData, 'all');

    await fs.writeFile(`${CONFIG.OUTPUT_DIR}/all.html`, html);
    await fs.writeFile(`${CONFIG.OUTPUT_DIR}/all.csv`,  csv);
  }

  showUsage() {
    console.log('Usage:');
    console.log('  node src/index.js --all              # Process all pages');
    console.log('  node src/index.js --page <number>    # Process single page');
    console.log('  node src/index.js --help             # Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  node src/index.js --all');
    console.log('  node src/index.js --page 42');
    console.log('');
    console.log('Alternative npm scripts:');
    console.log('  npm run process:all');
    console.log('  npm run process:page 42');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const processor = new GoetheBrListProcessor();

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    processor.showUsage();
    return;
  }

  if (args.includes('--all')) {
    await processor.processAll();
  } else if (args.includes('--page')) {
    const pageIndex = args.indexOf('--page');
    const pageNum   = parseInt(args[pageIndex + 1], 10);

    if (!pageNum || pageNum < CONFIG.PAGE_START || pageNum > CONFIG.PAGE_END) {
      console.error(`Invalid page number. Must be between ${CONFIG.PAGE_START} and ${CONFIG.PAGE_END}`);
      process.exit(1);
    }
    await processor.processPage(pageNum);
  } else {
    console.error('Invalid arguments. Use --help for usage information.');
    processor.showUsage();
    process.exit(1);
  }
}

// Global unhandled-rejection guard
process.on('unhandledRejection', (err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

main().catch(console.error);