import { promises as fs } from 'fs';
import { BREAK_OVERRIDES, CONFIG } from '../config.js';
import { padPageNumber } from '../utils/fs.js';

export class BreakDetector {
  constructor() {
    this.threshold = CONFIG.BREAK_THRESHOLD;
  }

  async detectBreaks(xmpPath, pageNum, column) {
    const paddedPage = padPageNumber(pageNum);
    const prefix = `${paddedPage}-${column}`;
    
    const content = await fs.readFile(xmpPath, 'utf8');
    const ranges = this.parseXMP(content, prefix);
    return ranges;
  }

  processOverrides(overrideSet) {
    const breaks = Array.from(overrideSet).sort((a, b) => a - b);
    const ranges = [];
    
    let start = 0;
    for (const breakPoint of breaks) {
      ranges.push([start, breakPoint]);
      start = breakPoint;
    }
    
    return ranges;
  }

  parseXMP(content, prefix) {
    const lines = content.split('\n');
    let pixels = false;
    let whiteCode = null;
    let y = 0;
    let state = 'trail';
    let start = null;
    let rectStart = 0;
    const ranges = [];
    
    // Get overrides for this prefix
    const overrides = BREAK_OVERRIDES[prefix] || new Set();

    for (const line of lines) {
      // Find white color code
      if (!pixels) {
        const whiteMatch = line.match(/"(\w+)\s+c\s+white"/);
        if (whiteMatch) {
          whiteCode = whiteMatch[1];
        }
        if (line.match(/^\/\*\s+pixels\s+\*\/$/)) {
          pixels = true;
          continue;
        }
      }

      if (!pixels) continue;

      // End of pixels section
      if (line.match(/^};/)) break;

      // Check if line is empty (all white pixels)
      const isEmpty = whiteCode && new RegExp(`^"(${whiteCode})+",?$`).test(line);
      
      // Check for override at this y coordinate
      if (overrides.has(y)) {
        state = 'overridden';
        start = 0;
      }

      // State machine for break detection
      switch (state) {
        case 'trail':
          if (!isEmpty) {
            state = 'look';
          }
          break;
          
        case 'look':
          if (isEmpty) {
            state = 'found';
            start = y;
          }
          break;
          
        case 'found':
        case 'overridden':
          if (isEmpty) {
            if (y > start + this.threshold) {
              ranges.push([rectStart, y]);
              rectStart = y;
              state = 'trail';
            }
          } else {
            state = 'look';
          }
          break;
      }

      y++;
    }

    // Final range
    if (state !== 'trail') {
      ranges.push([rectStart, y]);
    }

    return ranges;
  }

  async saveBreaks(ranges, outputPath) {
    const content = ranges.map(range => range.join(' ')).join('\n');
    await fs.writeFile(outputPath, content);
  }
}