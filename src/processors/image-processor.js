import sharp from 'sharp'
import { promises as fs } from 'fs'
import { CONFIG } from '../config.js'
import { fileExists, padPageNumber } from '../utils/fs.js'

export class ImageProcessor {
  constructor() {
    this.outputDir = CONFIG.OUTPUT_DIR
  }

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

  async cleanup(filePath) {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      // Ignore errors when cleaning up temporary files
    }
  }
}
