import * as mupdf from 'mupdf'
import { parentPort } from 'node:worker_threads'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { CONFIG } from '../../config.js'
import { fileExists, padPageNumber } from '../../utils/fs.js'

function genName(page) {
  return `${path.basename(CONFIG.PDF_FILE, '.pdf')}-${padPageNumber(page)}.png`
}

let docPromise // cached across jobs

function ensureDoc() {
  docPromise ??= fs
    .readFile(CONFIG.PDF_FILE)
    .then(buf => mupdf.PDFDocument.openDocument(buf, 'application/pdf'))
  return docPromise
}

parentPort.on('message', async ({ pageNum }) => {
  try {
    const outPath = path.join(CONFIG.OUTPUT_DIR, genName(pageNum))
    if (await fileExists(outPath)) {
      parentPort.postMessage(outPath)
      return
    }

    const document = await ensureDoc()
    const scale = CONFIG.PDF_DPI / 72
    const mat = mupdf.Matrix.scale(scale, scale)
    const page = document.loadPage(pageNum - 1)
    const pix = page.toPixmap(mat, mupdf.ColorSpace.DeviceRGB, false, true)
    await fs.writeFile(outPath, Buffer.from(pix.asPNG()))
    parentPort.postMessage(outPath)
  } catch (err) {
    parentPort.postMessage({ error: err.message, pageNum })
  }
})
