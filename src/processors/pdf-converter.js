import * as mupdf from 'mupdf'
import { promises as fs } from 'fs'
import path from 'node:path'
import { CONFIG } from '../config.js'
import { fileExists, padPageNumber } from '../utils/fs.js'
import { WorkerPool } from '../runtime/worker-pool.js'

/**
 * Generate the deterministic PNG filename for a given page number.
 * @param {number} pageNum – 1-based page index.
 */
function generatePngFilename(pageNum) {
  const base = path.basename(CONFIG.PDF_FILE, '.pdf')
  return `${base}-${padPageNumber(pageNum)}.png`
}

/**
 * Converts the Goethe B1 PDF pages to PNG using worker-threads.
 */
export class PDFConverter {
  constructor() {
    this.pdfFile = CONFIG.PDF_FILE
    this.outputDir = CONFIG.OUTPUT_DIR
    this._doc = null // lazily opened for page-count only
  }

  /** @private */
  async _getDocument() {
    if (this._doc) return this._doc
    const buf = await fs.readFile(this.pdfFile)
    this._doc = mupdf.PDFDocument.openDocument(buf, 'application/pdf')
    return this._doc
  }

  /**
   * Render missing pages in parallel via WorkerPool.
   */
  async convertPDFToPNG() {
    if (!(await fileExists(this.pdfFile))) {
      throw new Error(`PDF file not found: ${this.pdfFile}`)
    }

    await fs.mkdir(this.outputDir, { recursive: true })

    // Quick exit if everything is already rendered.
    const sentinel = path.join(this.outputDir, generatePngFilename(CONFIG.PAGE_END))
    if (await fileExists(sentinel)) {
      console.log('PDF → PNG: all pages already rendered – skipping')
      return
    }

    // Determine which pages are still needed.
    const doc = await this._getDocument()
    const pageCount = doc.countPages()
    const pagesTodo = []
    for (let i = CONFIG.PAGE_START; i <= Math.min(CONFIG.PAGE_END, pageCount); i++) {
      const outPath = path.join(this.outputDir, generatePngFilename(i))
      if (!(await fileExists(outPath))) pagesTodo.push(i)
    }
    if (pagesTodo.length === 0) return

    console.log(
      `Rendering ${pagesTodo.length} page(s) with worker threads (Node ${process.versions.node})…`,
    )

    const pool = new WorkerPool(new URL('../runtime/workers/pdf-render-worker.js', import.meta.url))
    await pool.ready()

    await Promise.all(pagesTodo.map(pageNum => pool.exec({ payload: { pageNum } })))

    await pool.destroy()
    console.log('PDF conversion completed ✔')
  }

  /**
   * Get the PNG path for a specific page (must exist).
   * @param {number} pageNum – 1-based index
   */
  async getPageImagePath(pageNum) {
    const img = path.join(this.outputDir, generatePngFilename(pageNum))
    if (!(await fileExists(img))) {
      throw new Error(`Expected PNG not found – run convertPDFToPNG(): ${img}`)
    }
    return img
  }
}
