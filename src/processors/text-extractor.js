import * as mupdf from 'mupdf'
import { promises as fs } from 'fs'
import { CONFIG } from '../config.js'

export class TextExtractor {
  constructor() {
    this.pdfFile = CONFIG.PDF_FILE
    this._doc = null // Loaded lazily
  }

  async _docPromise() {
    if (this._doc) return this._doc
    const buffer = await fs.readFile(this.pdfFile)
    this._doc = mupdf.PDFDocument.openDocument(buffer, 'application/pdf')
    return this._doc
  }

  /**
   * Extract the raw text from a rectangular region on a page.
   * Re-implements the pdftotext bounding-box mode using MuPDF’s
   * StructuredText JSON output.
   */
  async extractTextFromRegion(pageNum, x, y, width, height) {
    // MuPDF StructuredText works in PDF points (72 dpi);
    // pipeline coordinates are in image pixels (CONFIG.PDF_DPI).
    const scale = CONFIG.PDF_DPI / 72 // ≈ 4.166 for 300 dpi
    const doc = await this._docPromise()
    const page = doc.loadPage(pageNum - 1)
    const st = JSON.parse(page.toStructuredText('preserve-whitespace').asJSON())

    // Rectangle in point space
    const rx0 = x / scale
    const ry0 = y / scale
    const rx1 = (x + width) / scale
    const ry1 = (y + height) / scale

    const lines = []

    for (const block of st.blocks) {
      if (block.type !== 'text') continue
      for (const line of block.lines) {
        const { x: lx, y: ly, w: lw, h: lh } = line.bbox
        // AABB intersection in the *same* unit system
        if (lx + lw < rx0 || lx > rx1 || ly + lh < ry0 || ly > ry1) continue
        lines.push({ y: ly, x: lx, text: line.text })
      }
    }

    // Natural reading order
    lines.sort((a, b) => a.y - b.y || a.x - b.x)
    return lines
      .map(l => l.text)
      .join('\n')
      .trim()
  }

  /** unchanged public helper */
  async extractFromRanges(pageNum, ranges, column) {
    const columnConfig = column === 'l' ? CONFIG.LEFT_COLUMN : CONFIG.RIGHT_COLUMN
    const results = []

    for (let i = 0; i < ranges.length; i++) {
      const [y0, y1] = ranges[i]
      const regionHeight = y1 - y0

      const defText = await this.extractTextFromRegion(
        pageNum,
        columnConfig.TEXT_X,
        CONFIG.Y_OFFSET + y0,
        columnConfig.TEXT_WIDTH,
        regionHeight,
      )

      const exampleText = await this.extractTextFromRegion(
        pageNum,
        columnConfig.TEXT_X + columnConfig.TEXT_WIDTH,
        CONFIG.Y_OFFSET + y0,
        columnConfig.CROP_WIDTH - columnConfig.TEXT_WIDTH,
        regionHeight,
      )

      const [fixedDef, fixedExample] = this.applyPageSpecificFixes(
        pageNum,
        column,
        defText,
        exampleText,
      )

      results.push({
        index: i,
        definition: fixedDef,
        example: fixedExample,
        imagePath: `${CONFIG.OUTPUT_DIR}/${pageNum.toString().padStart(3, '0')}-${column}-${i}.png`,
      })
    }
    return results
  }

  // --- the rest of the original helper methods stay unchanged ---
  applyPageSpecificFixes(pageNum, column, def, example) {
    // (same as original implementation)
    if (pageNum === 79 && column === 'l') {
      if (def.match(/^die See.*die Nord.*Ostsee/ms) && example.match(/Im Sommer/)) {
        return ['die See', 'Im Sommer fahren wir immer an die See.']
      } else if (def.match(/^sehen,/) && example.match(/Warst du schon/)) {
        return ['die Nord-/Ostsee', 'Warst du schon mal an der Nord/Ostsee?']
      } else if (def === '' && example.match(/^1\.\s+Ich\s+sehe\s+nicht/)) {
        return ['sehen, sieht, sah, hat gesehen', example]
      }
    }
    return [def, example]
  }

  async saveExtractedData(data, outputPath) {
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2))
  }
}
