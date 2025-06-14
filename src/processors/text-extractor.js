import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { CONFIG } from '../config.js';

export class TextExtractor {
  constructor() {
    this.pdfFile = CONFIG.PDF_FILE;
  }

  async extractTextFromRegion(pageNum, x, y, width, height) {
    return new Promise((resolve, reject) => {
      const args = [
        '-f', pageNum.toString(),
        '-l', pageNum.toString(),
        '-r', CONFIG.PDF_DPI.toString(),
        '-x', x.toString(),
        '-y', y.toString(),
        '-W', width.toString(),
        '-H', height.toString(),
        this.pdfFile,
        '-'
      ];

      const pdftotext = spawn('pdftotext', args);
      let output = '';
      let error = '';

      pdftotext.stdout.on('data', (data) => {
        output += data.toString();
      });

      pdftotext.stderr.on('data', (data) => {
        error += data.toString();
      });

      pdftotext.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`pdftotext exited with code ${code}: ${error}`));
        }
      });

      pdftotext.on('error', (err) => {
        reject(new Error(`Failed to start pdftotext: ${err.message}`));
      });
    });
  }

  async extractFromRanges(pageNum, ranges, column) {
    const columnConfig = column === 'l' ? CONFIG.LEFT_COLUMN : CONFIG.RIGHT_COLUMN;
    const results = [];

    for (let i = 0; i < ranges.length; i++) {
      const [y0, y1] = ranges[i];
      const regionHeight = y1 - y0;
      
      // Extract definition text (left part of column)
      const defText = await this.extractTextFromRegion(
        pageNum,
        columnConfig.TEXT_X,
        CONFIG.Y_OFFSET + y0,
        columnConfig.TEXT_WIDTH,
        regionHeight
      );

      // Extract example text (right part of column) 
      const exampleText = await this.extractTextFromRegion(
        pageNum,
        columnConfig.TEXT_X + columnConfig.TEXT_WIDTH,
        CONFIG.Y_OFFSET + y0,
        columnConfig.CROP_WIDTH - columnConfig.TEXT_WIDTH,
        regionHeight
      );

      // Apply page-specific fixes
      const [fixedDef, fixedExample] = this.applyPageSpecificFixes(
        pageNum, column, defText, exampleText
      );

      results.push({
        index: i,
        definition: fixedDef,
        example: fixedExample,
        imagePath: `${CONFIG.OUTPUT_DIR}/${pageNum.toString().padStart(3, '0')}-${column}-${i}.png`
      });
    }

    return results;
  }

  applyPageSpecificFixes(pageNum, column, def, example) {
    // Fix up broken left column of page 079
    if (pageNum === 79 && column === 'l') {
      if (def.match(/^die See.*die Nord.*Ostsee/ms) && example.match(/Im Sommer/)) {
        return ['die See', 'Im Sommer fahren wir immer an die See.'];
      } else if (def.match(/^sehen,/) && example.match(/Warst du schon/)) {
        return ['die Nord-/Ostsee', 'Warst du schon mal an der Nord/Ostsee?'];
      } else if (def === '' && example.match(/^1\.\s+Ich\s+sehe\s+nicht/)) {
        return ['sehen, sieht, sah, hat gesehen', example];
      }
    }

    return [def, example];
  }

  async saveExtractedData(data, outputPath) {
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
  }
}