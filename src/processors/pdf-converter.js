import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { CONFIG } from '../config.js';
import { fileExists, padPageNumber } from '../utils/fs.js';

export class PDFConverter {
  constructor() {
    this.pdfFile = CONFIG.PDF_FILE;
    this.outputDir = CONFIG.OUTPUT_DIR;
  }

  async convertPDFToPNG() {
    // Check if PDF exists
    if (!(await fileExists(this.pdfFile))) {
      throw new Error(`PDF file not found: ${this.pdfFile}`);
    }

    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    // Check if already converted (check for last page)
    const lastPageFile = `${this.outputDir}/Goethe-Zertifikat_B1_Wortliste-104.png`;
    if (await fileExists(lastPageFile)) {
      console.log('PNG files already exist, skipping conversion');
      return;
    }

    console.log('Converting PDF to PNG files...');
    
    return new Promise((resolve, reject) => {
      const args = [
        '-png',
        '-r', CONFIG.PDF_DPI.toString(),
        this.pdfFile,
        `${this.outputDir}/Goethe-Zertifikat_B1_Wortliste`
      ];

      const pdftocairo = spawn('pdftocairo', args);
      
      pdftocairo.stdout.on('data', (data) => {
        console.log(`pdftocairo: ${data}`);
      });

      pdftocairo.stderr.on('data', (data) => {
        console.error(`pdftocairo error: ${data}`);
      });

      pdftocairo.on('close', (code) => {
        if (code === 0) {
          console.log('PDF conversion completed');
          resolve();
        } else {
          reject(new Error(`pdftocairo exited with code ${code}`));
        }
      });

      pdftocairo.on('error', (error) => {
        reject(new Error(`Failed to start pdftocairo: ${error.message}`));
      });
    });
  }

  async getPageImagePath(pageNum) {
    const paddedPage = padPageNumber(pageNum);
    const imagePath = `${this.outputDir}/Goethe-Zertifikat_B1_Wortliste-${paddedPage}.png`;
    
    if (!(await fileExists(imagePath))) {
      throw new Error(`Page image not found: ${imagePath}`);
    }
    
    return imagePath;
  }
}