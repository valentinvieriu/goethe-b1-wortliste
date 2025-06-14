#!/usr/bin/env node

import { promises as fs } from 'fs';
import { CONFIG } from './config.js';
import { PDFConverter } from './processors/pdf-converter.js';
import { PageProcessor } from './processors/page-processor.js';
import { DataProcessor } from './processors/data-processor.js';
import { fileExists } from './utils/fs.js';

class GoetheBrListProcessor {
  constructor() {
    this.pdfConverter = new PDFConverter();
    this.pageProcessor = new PageProcessor();
    this.dataProcessor = new DataProcessor();
  }

  async processAll() {
    console.log('Starting Goethe B1 Wortliste processing...');

    // Check if PDF exists
    if (!(await fileExists(CONFIG.PDF_FILE))) {
      console.error(`PDF file not found: ${CONFIG.PDF_FILE}`);
      console.error('Get yourself Goethe-Zertifikat_B1_Wortliste.pdf');
      console.error('It used to live at https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf');
      process.exit(1);
    }

    // Ensure output directory exists
    await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });

    // Convert PDF to PNG if needed
    await this.pdfConverter.convertPDFToPNG();

    // Process all pages
    console.log('Processing pages...');
    let allRawData = [];
    
    for (let pageNum = CONFIG.PAGE_START; pageNum <= CONFIG.PAGE_END; pageNum++) {
      try {
        await this.pageProcessor.processPage(pageNum);
        
        // Collect raw data for combined output
        const paddedPage = pageNum.toString().padStart(3, '0');
        const leftFile = `${CONFIG.OUTPUT_DIR}/${paddedPage}-l.json`;
        const rightFile = `${CONFIG.OUTPUT_DIR}/${paddedPage}-r.json`;
        
        if (await fileExists(leftFile)) {
          const leftData = JSON.parse(await fs.readFile(leftFile, 'utf8'));
          allRawData = this.dataProcessor.processRawData(leftData, allRawData);
        }
        
        if (await fileExists(rightFile)) {
          const rightData = JSON.parse(await fs.readFile(rightFile, 'utf8'));
          allRawData = this.dataProcessor.processRawData(rightData, allRawData);
        }
      } catch (error) {
        console.error(`Error processing page ${pageNum}:`, error.message);
      }
    }

    // Generate final combined files
    console.log('Generating final combined files...');
    await this.generateCombinedOutputs(allRawData);

    console.log('Processing completed successfully!');
  }

  async processPage(pageNum) {
    console.log(`Processing single page: ${pageNum}`);

    // Check if PDF exists
    if (!(await fileExists(CONFIG.PDF_FILE))) {
      console.error(`PDF file not found: ${CONFIG.PDF_FILE}`);
      process.exit(1);
    }

    // Ensure output directory exists
    await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });

    // Convert PDF to PNG if needed
    await this.pdfConverter.convertPDFToPNG();

    // Process the specific page
    try {
      await this.pageProcessor.processPage(pageNum);
      console.log(`Page ${pageNum} processed successfully!`);
    } catch (error) {
      console.error(`Error processing page ${pageNum}:`, error.message);
      process.exit(1);
    }
  }

  async generateCombinedOutputs(allData) {
    const processedData = await this.dataProcessor.processExtractedData(allData);
    
    const html = await this.dataProcessor.generateHTML(processedData, 'all');
    const csv = await this.dataProcessor.generateCSV(processedData, 'all');

    await fs.writeFile(`${CONFIG.OUTPUT_DIR}/all.html`, html);
    await fs.writeFile(`${CONFIG.OUTPUT_DIR}/all.csv`, csv);
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
    const pageNum = parseInt(args[pageIndex + 1]);
    
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

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Run main function
main().catch(console.error);