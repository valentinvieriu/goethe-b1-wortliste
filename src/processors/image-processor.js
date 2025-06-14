import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { CONFIG } from '../config.js';
import { fileExists, padPageNumber } from '../utils/fs.js';

export class ImageProcessor {
  constructor() {
    this.outputDir = CONFIG.OUTPUT_DIR;
  }

  async cropColumnToXPM(imagePath, pageNum, column) {
    const paddedPage = padPageNumber(pageNum);
    const columnConfig = column === 'l' ? CONFIG.LEFT_COLUMN : CONFIG.RIGHT_COLUMN;
    const xpmPath = `${this.outputDir}/${paddedPage}-${column}.xpm`;

    // Skip if already exists
    if (await fileExists(xpmPath)) {
      return xpmPath;
    }

    const cropWidth = columnConfig.CROP_WIDTH;
    const cropHeight = CONFIG.IMAGE_HEIGHT;
    const cropX = columnConfig.CROP_X;
    const cropY = CONFIG.Y_OFFSET;

    return new Promise((resolve, reject) => {
      const args = [
        imagePath,
        '-crop', `${cropWidth}x${cropHeight}+${cropX}+${cropY}`,
        xpmPath
      ];

      console.log(`Running convert: ${['convert', ...args].join(' ')}`);
      const convert = spawn('convert', args);

      convert.stderr.on('data', (data) => {
        console.error(`convert crop error: ${data}`);
      });

      convert.stdout.on('data', (data) => {
        console.log(`convert crop output: ${data}`);
      });

      convert.on('close', (code) => {
        if (code === 0) {
          resolve(xpmPath);
        } else {
          reject(new Error(`convert crop exited with code ${code}. Args: ${args.join(' ')}`));
        }
      });

      convert.on('error', (error) => {
        reject(new Error(`Failed to start convert: ${error.message}`));
      });
    });
  }

  async cropRegion(imagePath, x, y, width, height, outputPath) {
    return new Promise((resolve, reject) => {
      const args = [
        imagePath,
        '-crop', `${width}x${height}+${x}+${y}`,
        '+repage',
        outputPath
      ];

      const convert = spawn('convert', args);

      convert.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`convert exited with code ${code}`));
        }
      });

      convert.on('error', (error) => {
        reject(new Error(`Failed to start convert: ${error.message}`));
      });
    });
  }

  async annotateImage(imagePath, outputPath, rectangles) {
    return new Promise((resolve, reject) => {
      const args = [imagePath, '-fill', 'transparent', '-stroke', 'red'];
      
      for (const rect of rectangles) {
        args.push('-draw', `rectangle ${rect.x0},${rect.y0} ${rect.x1},${rect.y1}`);
      }
      
      args.push(outputPath);

      const convert = spawn('convert', args);

      convert.stderr.on('data', (data) => {
        console.error(`convert annotation error: ${data}`);
      });

      convert.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`convert annotation exited with code ${code}`));
        }
      });

      convert.on('error', (error) => {
        reject(new Error(`Failed to start convert for annotation: ${error.message}`));
      });
    });
  }

  async cleanup(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore errors when cleaning up temporary files
    }
  }
}