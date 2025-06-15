import sharp from 'sharp'
import { promises as fs } from 'fs'
import { CONFIG } from '../config.js'
import { padPageNumber } from '../utils/fs.js'
import { WorkerPool } from '../runtime/worker-pool.js'

/**
 * Wrapper around Sharp that delegates heavy tasks to worker-threads.
 */
export class ImageProcessor {
  constructor() {
    this.outputDir = CONFIG.OUTPUT_DIR
    this._pool = new WorkerPool(new URL('../runtime/workers/image-worker.js', import.meta.url))
    // Initialise workers in the background; methods await this._ready when needed.
    this._ready = this._pool.ready()
  }

  /**
   * Extract raw pixel data for break-detection (runs on main thread to avoid
   * transferring multi-MB buffers back from a worker).
   */
  async getColumnRawPixels(imagePath, pageNum, column) {
    const columnCfg = column === 'l' ? CONFIG.LEFT_COLUMN : CONFIG.RIGHT_COLUMN
    const { CROP_X: left, CROP_WIDTH: width } = columnCfg
    const top = CONFIG.Y_OFFSET
    const height = CONFIG.IMAGE_HEIGHT

    const { data, info } = await sharp(imagePath)
      .extract({ left, top, width, height })
      .raw()
      .toBuffer({ resolveWithObject: true })

    return { data, info }
  }

  /**
   * Crop a rectangular region on a worker thread.
   */
  async cropRegion(imagePath, x, y, width, height, outputPath) {
    await this._ready
    return this._pool.exec({
      payload: { action: 'crop', imagePath, x, y, width, height, outputPath },
    })
  }

  /**
   * Annotate an image with semi-transparent rectangles on a worker thread.
   */
  async annotateImage(imagePath, outputPath, rectangles) {
    await this._ready
    return this._pool.exec({
      payload: { action: 'annotate', imagePath, outputPath, rectangles },
    })
  }

  /** Release worker resources (optional). */
  async destroy() {
    await this._pool.destroy()
  }
}
