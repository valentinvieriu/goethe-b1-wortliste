import * as mupdf from 'mupdf'
import { promises as fs } from 'fs'
import { CONFIG } from '../config.js'

/**
 * @class TextExtractor
 * @description Extracts text from specific regions of a PDF page using `mupdf`'s
 * structured text output. This avoids traditional OCR by reading text directly
 * from the PDF's internal representation, which is faster and more accurate.
 */
export class TextExtractor {
  /**
   * Creates a new text extractor instance.
   */
  constructor() {
    this.pdfFile = CONFIG.PDF_FILE
    this._doc = null // Loaded lazily
  }

  /**
   * Lazily loads the PDF document using MuPDF.js and caches the instance
   * to avoid re-loading the file for subsequent extractions.
   * @private
   * @returns {Promise<mupdf.PDFDocument>} A promise that resolves to the loaded document instance.
   */
  async _docPromise() {
    if (this._doc) return this._doc
    const buffer = await fs.readFile(this.pdfFile)
    this._doc = mupdf.PDFDocument.openDocument(buffer, 'application/pdf')
    return this._doc
  }

  /**
   * Extracts the raw text from a specified rectangular region on a PDF page.
   * It uses MuPDF's structured text JSON output, filtering text blocks and lines
   * that fall within the given bounding box (converted from image pixel
   * coordinates to PDF point coordinates).
   *
   * @param {number} pageNum - The 1-based page number to extract from.
   * @param {number} x - The x-coordinate of the region's top-left corner in image pixels.
   * @param {number} y - The y-coordinate of the region's top-left corner in image pixels.
   * @param {number} width - The width of the region in image pixels.
   * @param {number} height - The height of the region in image pixels.
   * @returns {Promise<string>} A promise that resolves to the extracted and sorted text.
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

  /**
   * Extracts text for a series of vertical ranges within a specific page column.
   * For each range, it extracts both the definition and example text by splitting
   * the column into two sub-regions.
   *
   * @param {number} pageNum - The 1-based page number to process.
   * @param {Array<[number, number]>} ranges - An array of [y0, y1] detected break ranges.
   * @param {'l'|'r'} column - The column identifier ('l' for left, 'r' for right).
   * @returns {Promise<Array<object>>} A promise that resolves to an array of extracted entry objects.
   */
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
  /**
   * Applies ad-hoc, hardcoded fixes for known text extraction errors on specific pages.
   * This handles rare cases where the standard text extraction logic fails.
   * @private
   * @param {number} pageNum - The current page number.
   * @param {'l'|'r'} column - The column identifier.
   * @param {string} def - The extracted definition text.
   * @param {string} example - The extracted example text.
   * @returns {[string, string]} A tuple containing the (potentially corrected) definition and example.
   */
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

  /**
   * Persists the extracted data for a column to a JSON file.
   * The JSON is pretty-printed for readability.
   *
   * @param {Array<object>} data - The array of extracted entry objects to save.
   * @param {string} outputPath - The destination file path for the JSON file.
   * @returns {Promise<void>} A promise that resolves when the file has been written.
   */
  async saveExtractedData(data, outputPath) {
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2))
  }
}
