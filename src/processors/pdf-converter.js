import * as mupdf from 'mupdf'
import { promises as fs } from 'fs'
import { cpus } from 'os'
import path from 'path'
import { CONFIG } from '../config.js'
import { fileExists, padPageNumber } from '../utils/fs.js'

/**
 * Generates the PNG filename for a given page number.
 * @param {number} pageNum - The 1-based page number.
 * @returns {string} The corresponding PNG filename (e.g., "Goethe-Zertifikat_B1_Wortliste-042.png").
 */
function generatePngFilename(pageNum) {
  const baseName = path.basename(CONFIG.PDF_FILE, '.pdf')
  const paddedPage = padPageNumber(pageNum)
  return `${baseName}-${paddedPage}.png`
}

/**
 * @class PDFConverter
 * @description Converts pages from the source PDF file into high-resolution PNG images.
 * It uses the `mupdf` library for rendering and performs conversions in parallel,
 * utilizing all available CPU cores to maximize speed.
 */
export class PDFConverter {
  /**
   * Creates a new PDFConverter instance.
   * It stores configuration values and prepares for lazy-loading of the PDF document.
   */
  constructor() {
    this.pdfFile = CONFIG.PDF_FILE
    this.outputDir = CONFIG.OUTPUT_DIR
    this._doc = null // Lazy-loaded MuPDF document
  }

  /**
   * Lazily opens the PDF document using MuPDF.js, caching the document
   * instance so it is only loaded and parsed once.
   * @private
   * @returns {Promise<mupdf.PDFDocument>} A promise that resolves to the opened MuPDF document instance.
   */
  async _getDocument() {
    if (this._doc) return this._doc
    const pdfBuffer = await fs.readFile(this.pdfFile)
    this._doc = mupdf.PDFDocument.openDocument(pdfBuffer, 'application/pdf')
    return this._doc
  }

  /**
   * A generic utility to run an async iterator function over a list of items
   * with a specified concurrency limit.
   * @private
   * @template T
   * @param {T[]} items - An array of items to iterate over.
   * @param {number} limit - The maximum number of async operations to run in parallel.
   * @param {(item: T) => Promise<any>} iteratorFn - The async function to execute for each item.
   * @returns {Promise<void>} A promise that resolves when all items have been processed.
   */
  async _runWithConcurrency(items, limit, iteratorFn) {
    const executing = []
    for (const item of items) {
      const p = Promise.resolve().then(() => iteratorFn(item))
      const e = p.then(() => executing.splice(executing.indexOf(e), 1))
      executing.push(e)
      if (executing.length >= limit) {
        await Promise.race(executing)
      }
    }
    await Promise.all(executing)
  }

  /**
   * Renders the required pages from the PDF into PNG files at the configured DPI.
   * The conversion runs in parallel, with concurrency limited by the number of CPU cores.
   * It skips pages that have already been rendered.
   * @returns {Promise<void>} A promise that resolves when all conversions are complete.
   */
  async convertPDFToPNG() {
    if (!(await fileExists(this.pdfFile))) {
      throw new Error(`PDF file not found: ${this.pdfFile}`)
    }

    await fs.mkdir(this.outputDir, { recursive: true })

    // Sentinel: if the very last expected PNG exists, assume all pages done
    const sentinel = `${this.outputDir}/${generatePngFilename(CONFIG.PAGE_END)}`
    if (await fileExists(sentinel)) {
      console.log('PNG files already exist, skipping conversion')
      return
    }

    console.log('Converting PDF to PNG files with MuPDF.js (parallel)…')
    const doc = await this._getDocument()
    const pageCount = doc.countPages()
    const scale = CONFIG.PDF_DPI / 72 // 72 dpi is the PDF default
    const matrix = mupdf.Matrix.scale(scale, scale)

    // Build a list of pages that still need rendering
    const todo = []
    for (let zeroBased = 0; zeroBased < pageCount; zeroBased++) {
      const oneBased = zeroBased + 1
      if (oneBased < CONFIG.PAGE_START || oneBased > CONFIG.PAGE_END) continue
      const padded = padPageNumber(oneBased)
      const outPath = `${this.outputDir}/${generatePngFilename(oneBased)}`
      if (await fileExists(outPath)) continue
      todo.push(oneBased)
    }

    const concurrency = Math.max(1, cpus().length)

    await this._runWithConcurrency(todo, concurrency, async oneBased => {
      const padded = padPageNumber(oneBased)
      const outPath = `${this.outputDir}/${generatePngFilename(oneBased)}`

      // Double-check in case another worker already rendered it
      if (await fileExists(outPath)) return

      const page = doc.loadPage(oneBased - 1)
      const pix = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
      await fs.writeFile(outPath, Buffer.from(pix.asPNG()))
      console.log(`Rendered page ${padded}`)
    })

    console.log('PDF conversion completed (MuPDF.js).')
  }

  /**
   * Constructs the file path for a previously rendered PNG page image and verifies its existence.
   *
   * @param {number} pageNum - The 1-based page number.
   * @returns {Promise<string>} A promise that resolves to the full path of the PNG image.
   * @throws {Error} If the image file for the specified page does not exist.
   */
  async getPageImagePath(pageNum) {
    const paddedPage = padPageNumber(pageNum)
    const imagePath = `${this.outputDir}/${generatePngFilename(pageNum)}`

    if (!(await fileExists(imagePath))) {
      throw new Error(`Page image not found: ${imagePath}`)
    }
    return imagePath
  }
}
