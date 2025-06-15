import sharp from 'sharp'
import { promises as fs } from 'fs'
import { CONFIG } from '../config.js'
import { fileExists, padPageNumber } from '../utils/fs.js'

/**
 * @class ImageProcessor
 * @description A utility class that wraps the 'sharp' library to perform
 * all image manipulation tasks, such as cropping, extracting pixel data,
 * and annotating images with overlayed regions.
 */
export class ImageProcessor {
  /**
   * Creates an instance of ImageProcessor.
   */
  constructor() {
    this.outputDir = CONFIG.OUTPUT_DIR
  }

  /**
   * Extracts raw pixel data for a specified column from a page image.
   * The column's dimensions are determined by the application configuration.
   *
   * @param {string} imagePath - The file path to the source page image (PNG).
   * @param {number} pageNum - The page number, used for logging and context.
   * @param {'l'|'r'} column - The column identifier ('l' for left, 'r' for right).
   * @returns {Promise<{data: Buffer, info: import('sharp').OutputInfo}>} A promise that resolves to an object containing the raw pixel data buffer and sharp's metadata info.
   */
  async getColumnRawPixels(imagePath, pageNum, column) {
    const paddedPage = padPageNumber(pageNum)
    const columnConfig = column === 'l' ? CONFIG.LEFT_COLUMN : CONFIG.RIGHT_COLUMN

    // We don't save the raw pixels directly, they are processed in memory.
    // However, if we were to cache, it would be as a processed text file.

    const cropWidth = columnConfig.CROP_WIDTH
    const cropHeight = CONFIG.IMAGE_HEIGHT
    const cropX = columnConfig.CROP_X
    const cropY = CONFIG.Y_OFFSET

    try {
      const { data, info } = await sharp(imagePath)
        .extract({ left: cropX, top: cropY, width: cropWidth, height: cropHeight })
        .raw()
        .toBuffer({ resolveWithObject: true })

      return { data, info }
    } catch (error) {
      throw new Error(
        `Failed to extract raw pixels for page ${paddedPage}, column ${column}: ${error.message}`,
      )
    }
  }

  /**
   * Crops a rectangular region from an image and saves it to a new file.
   *
   * @param {string} imagePath - The file path to the source image.
   * @param {number} x - The horizontal offset for the top-left corner of the crop region.
   * @param {number} y - The vertical offset for the top-left corner of the crop region.
   * @param {number} width - The width of the crop region.
   * @param {number} height - The height of the crop region.
   * @param {string} outputPath - The file path where the cropped PNG image will be saved.
   * @returns {Promise<string>} A promise that resolves to the output path of the written file.
   */
  async cropRegion(imagePath, x, y, width, height, outputPath) {
    try {
      await sharp(imagePath)
        .extract({ left: x, top: y, width: width, height: height })
        .toFile(outputPath)
      return outputPath
    } catch (error) {
      throw new Error(`Failed to crop region to ${outputPath}: ${error.message}`)
    }
  }

  /**
   * Overlays semi-transparent rectangles on an image to highlight specified regions,
   * such as detected vocabulary blocks. Writes the result to a new file.
   *
   * @param {string} imagePath - The file path to the source image.
   * @param {string} outputPath - The destination file path for the annotated image.
   * @param {Array<{x0: number, y0: number, x1: number, y1: number}>} rectangles - An array of rectangle coordinates to draw.
   * @returns {Promise<string>} A promise that resolves to the path of the annotated image.
   */
  async annotateImage(imagePath, outputPath, rectangles) {
    try {
      // Read the input image into a buffer to avoid potential file locking/path conflicts
      const inputImageBuffer = await fs.readFile(imagePath)
      const originalImage = sharp(inputImageBuffer)
      const metadata = await originalImage.metadata()

      const overlays = []
      for (const rect of rectangles) {
        // Create a blank red rectangle image
        const rectBuffer = await sharp({
          create: {
            width: rect.x1 - rect.x0,
            height: rect.y1 - rect.y0,
            channels: 4,
            background: { r: 255, g: 0, b: 0, alpha: 0.2 }, // Semi-transparent red
          },
        })
          .png()
          .toBuffer()

        overlays.push({
          input: rectBuffer,
          left: rect.x0,
          top: rect.y0,
          blend: 'over',
        })
      }

      const tempOutputPath = `${outputPath}.tmp` // Use a temporary file

      await originalImage.composite(overlays).toFile(tempOutputPath) // Write to temp file

      // Rename the temporary file to the final output path
      await fs.rename(tempOutputPath, outputPath)

      return outputPath
    } catch (error) {
      // Provide more specific context in the error message
      throw new Error(
        `Failed to annotate image ${outputPath} from input ${imagePath}: ${error.message}`,
      )
    }
  }

  /**
   * Removes a temporary file if it exists, ignoring any errors
   * if the file is already gone.
   *
   * @param {string} filePath - The path to the file to delete.
   * @returns {Promise<void>} A promise that resolves once the unlink operation is attempted.
   */
  async cleanup(filePath) {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      // Ignore errors when cleaning up temporary files
    }
  }
}
