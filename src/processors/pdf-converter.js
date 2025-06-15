import * as mupdf from 'mupdf'
import { promises as fs } from 'fs'
import { cpus } from 'os'
import path from 'path'
import { CONFIG } from '../config.js'
import { fileExists, padPageNumber } from '../utils/fs.js'

/**
 * Generate PNG filename based on PDF filename
 */
function generatePngFilename(pageNum) {
  const baseName = path.basename(CONFIG.PDF_FILE, '.pdf')
  const paddedPage = padPageNumber(pageNum)
  return `${baseName}-${paddedPage}.png`
}

/**
 * PDFConverter
 * ------------
 * Converts the Goethe B1 Wortliste PDF pages to individual PNG images
 * using MuPDF.js (WASM).  Rendering now happens in parallel across
 * the available CPU cores for a significant speed-up on multicore hosts.
 */
export class PDFConverter {
  constructor() {
    this.pdfFile = CONFIG.PDF_FILE
    this.outputDir = CONFIG.OUTPUT_DIR
    this._doc = null // Lazy-loaded MuPDF document
  }

  /** Lazily open the document (only once) */
  async _getDocument() {
    if (this._doc) return this._doc
    const pdfBuffer = await fs.readFile(this.pdfFile)
    this._doc = mupdf.PDFDocument.openDocument(pdfBuffer, 'application/pdf')
    return this._doc
  }

  /**
   * Generic bounded-concurrency runner.
   * @template T
   * @param {T[]} items
   * @param {number} limit
   * @param {(item:T)=>Promise<void>} iteratorFn
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
   * Render required pages as PNG files (300 DPI by default) in parallel.
   * Concurrency defaults to the number of available CPU cores.
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

  /** Path helper (unchanged) */
  async getPageImagePath(pageNum) {
    const paddedPage = padPageNumber(pageNum)
    const imagePath = `${this.outputDir}/${generatePngFilename(pageNum)}`

    if (!(await fileExists(imagePath))) {
      throw new Error(`Page image not found: ${imagePath}`)
    }
    return imagePath
  }
}
