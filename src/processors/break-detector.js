import { promises as fs } from 'fs'
import { BREAK_OVERRIDES, CONFIG } from '../config.js'
import { padPageNumber } from '../utils/fs.js'

export class BreakDetector {
  constructor() {
    this.threshold = CONFIG.BREAK_THRESHOLD
  }

  /**
   * Detects breaks in a column's raw pixel data.
   * @param {Buffer} pixelBuffer - Raw pixel data buffer from sharp.
   * @param {Object} info - Metadata from sharp ({ width, height, channels }).
   * @param {number} pageNum - The page number.
   * @param {string} column - The column ('l' or 'r').
   * @returns {Array<Array<number>>} An array of [startY, endY] ranges.
   */
  detectBreaks(pixelBuffer, info, pageNum, column) {
    const paddedPage = padPageNumber(pageNum)
    const prefix = `${paddedPage}-${column}`
    const { width, height, channels } = info

    let y = 0
    let state = 'trail'
    let start = null
    let rectStart = 0
    const ranges = []

    // Get overrides for this prefix
    const overrides = BREAK_OVERRIDES[prefix] || new Set()

    // Iterate through each row of pixels
    for (y = 0; y < height; y++) {
      // Check for override at this y coordinate (relative to cropped image)
      if (overrides.has(y)) {
        state = 'overridden'
        start = 0 // Reset start for override to ensure a break is registered
      }

      const rowIsEmpty = this.isRowEmpty(pixelBuffer, y, width, channels)

      // State machine for break detection
      switch (state) {
        case 'trail': // Trailing non-empty content, waiting for content to start
          if (!rowIsEmpty) {
            state = 'look' // Found content, now looking for a break
          }
          break

        case 'look': // Looking for a break (empty line)
          if (rowIsEmpty) {
            state = 'found' // Found an empty line, potential break start
            start = y
          }
          break

        case 'found': // Found an empty line, checking if it's long enough for a break
        case 'overridden': // Overridden state forces a break
          if (rowIsEmpty) {
            if (y > start + this.threshold || state === 'overridden') {
              ranges.push([rectStart, y])
              rectStart = y
              state = 'trail' // Reset after a break
            }
          } else {
            state = 'look' // Empty streak broken, continue looking for next break
          }
          break
      }
    }

    // Add the final range if we were in a content or break state
    if (state !== 'trail') {
      ranges.push([rectStart, y])
    }

    return ranges
  }

  /**
   * Checks if a row of pixels is predominantly "white" (empty).
   * Assumes RGB or RGBA format.
   */
  isRowEmpty(pixelBuffer, rowIdx, width, channels) {
    const rowStartOffset = rowIdx * width * channels
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowStartOffset + x * channels
      const r = pixelBuffer[pixelOffset]
      const g = pixelBuffer[pixelOffset + 1]
      const b = pixelBuffer[pixelOffset + 2]

      // Assuming white is RGB (255, 255, 255) or close to it.
      // Allow for some tolerance due to anti-aliasing or compression artifacts.
      // A common threshold for "mostly white" could be > 240 for each channel.
      const whiteThreshold = 240 // Adjust as needed

      if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
        return false // Found a non-white pixel
      }
    }
    return true // All pixels in the row are sufficiently white
  }
}
