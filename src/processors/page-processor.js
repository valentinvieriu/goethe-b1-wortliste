import { promises as fs } from 'fs'
import { CONFIG } from '../config.js'
import { PDFConverter } from './pdf-converter.js'
import { ImageProcessor } from './image-processor.js'
import { BreakDetector } from './break-detector.js'
import { TextExtractor } from './text-extractor.js'
import { DataProcessor } from './data-processor.js'
import { fileExists, padPageNumber } from '../utils/fs.js'

/**
 * @class PageProcessor
 * @description Orchestrates the entire processing pipeline for a single page of the PDF.
 * It coordinates the conversion, break detection, text extraction, data processing,
 * and final output generation for one page at a time. It also manages caching of
 * intermediate results to speed up reprocessing.
 */
export class PageProcessor {
  /**
   * Initializes all necessary processor modules.
   */
  constructor() {
    this.pdfConverter = new PDFConverter()
    this.imageProcessor = new ImageProcessor()
    this.breakDetector = new BreakDetector()
    this.textExtractor = new TextExtractor()
    this.dataProcessor = new DataProcessor()
    this.outputDir = CONFIG.OUTPUT_DIR
  }

  /**
   * Processes a single page of the PDF, from image conversion to final CSV output.
   * This is the main entry point for page-level processing.
   *
   * @param {number} pageNum - The 1-based page number to process.
   * @returns {Promise<Array<{definition: string, example: string}>>} A promise that resolves to an array of processed vocabulary entries for the page.
   */
  async processPage(pageNum) {
    const paddedPage = padPageNumber(pageNum)
    console.log(`Processing page ${paddedPage}...`)

    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true })

    // Get page image path
    const imagePath = await this.pdfConverter.getPageImagePath(pageNum)

    // Process both columns (without annotation)
    const { data: leftData, ranges: leftRanges } = await this.processColumn(imagePath, pageNum, 'l')
    const { data: rightData, ranges: rightRanges } = await this.processColumn(
      imagePath,
      pageNum,
      'r',
    )

    // Create annotation for BOTH columns together
    await this.createCombinedAnnotation(imagePath, pageNum, leftRanges, rightRanges)

    // Process data incrementally like Ruby version does
    let rawData = []
    rawData = this.dataProcessor.processRawData(leftData, rawData)
    rawData = this.dataProcessor.processRawData(rightData, rawData)

    // Now process the text formatting
    const processedData = await this.dataProcessor.processExtractedData(rawData)

    // Generate outputs
    await this.generateOutputs(processedData, paddedPage)

    console.log(`Page ${paddedPage} completed`)
    return processedData
  }

  /**
   * Processes a single column ('l' or 'r') of a page. This involves detecting
   * content breaks, extracting text from those breaks, and generating cropped images.
   * It caches results in the output directory to avoid re-doing work.
   *
   * @param {string} imagePath - The file path to the full-page PNG image.
   * @param {number} pageNum - The page number being processed.
   * @param {'l'|'r'} column - The column identifier ('l' for left, 'r' for right).
   * @returns {Promise<{data: Array<object>, ranges: Array<[number, number]>}>} A promise resolving to the extracted data and the detected break ranges.
   */
  async processColumn(imagePath, pageNum, column) {
    const paddedPage = padPageNumber(pageNum)
    const rangesFile = `${this.outputDir}/${paddedPage}-${column}.txt`
    const dataFile = `${this.outputDir}/${paddedPage}-${column}.json`

    // Check if already processed
    if (await fileExists(dataFile)) {
      const content = await fs.readFile(dataFile, 'utf8')
      const data = JSON.parse(content)

      // Also need to load ranges if they exist
      let ranges = []
      if (await fileExists(rangesFile)) {
        const rangesContent = await fs.readFile(rangesFile, 'utf8')
        ranges = rangesContent
          .trim()
          .split('\n')
          .map(line => {
            const [start, end] = line.split(' ').map(Number)
            return [start, end]
          })
      }

      return { data: data, ranges: ranges }
    }

    let ranges

    // Get or detect ranges
    if (await fileExists(rangesFile)) {
      const rangesContent = await fs.readFile(rangesFile, 'utf8')
      ranges = rangesContent
        .trim()
        .split('\n')
        .map(line => {
          const [start, end] = line.split(' ').map(Number)
          return [start, end]
        })
    } else {
      console.log(`${paddedPage}: Figuring out ranges for column ${column}...`)

      // Get raw pixel data for analysis
      const { data: pixelBuffer, info: pixelInfo } = await this.imageProcessor.getColumnRawPixels(
        imagePath,
        pageNum,
        column,
      )

      // Detect breaks
      ranges = this.breakDetector.detectBreaks(pixelBuffer, pixelInfo, pageNum, column)

      // Save ranges
      await fs.writeFile(rangesFile, ranges.map(r => r.join(' ')).join('\n'))
    }

    // Extract text from ranges
    console.log(`${paddedPage}: Extracting text from column ${column}...`)
    const extractedData = await this.textExtractor.extractFromRanges(pageNum, ranges, column)

    // Create cropped images for each region
    await this.createCroppedImages(imagePath, pageNum, ranges, column)

    // Save extracted data
    await this.textExtractor.saveExtractedData(extractedData, dataFile)

    return { data: extractedData, ranges: ranges }
  }

  /**
   * Generates a single annotated image for a page, showing the detected break
   * ranges for both columns as semi-transparent overlays. Skips if the file already exists.
   *
   * @param {string} imagePath - Path to the original page PNG.
   * @param {number} pageNum - Current page number.
   * @param {Array<[number, number]>} leftRanges - Break ranges for the left column.
   * @param {Array<[number, number]>} rightRanges - Break ranges for the right column.
   * @returns {Promise<void>} A promise that resolves when the annotation is written.
   */
  async createCombinedAnnotation(imagePath, pageNum, leftRanges, rightRanges) {
    const paddedPage = padPageNumber(pageNum)
    const annotPath = `${this.outputDir}/${paddedPage}-annot.png`

    // Skip if annotation already exists
    if (await fileExists(annotPath)) {
      return
    }

    console.log(`${paddedPage}: Creating annotation...`)

    // Create rectangles for left column
    const leftRectangles = leftRanges.map(([y0, y1]) => ({
      x0: CONFIG.LEFT_COLUMN.CROP_X,
      y0: CONFIG.Y_OFFSET + y0,
      x1: CONFIG.LEFT_COLUMN.FULL_WIDTH,
      y1: CONFIG.Y_OFFSET + y1,
    }))

    // Create rectangles for right column
    const rightRectangles = rightRanges.map(([y0, y1]) => ({
      x0: CONFIG.RIGHT_COLUMN.CROP_X,
      y0: CONFIG.Y_OFFSET + y0,
      x1: CONFIG.RIGHT_COLUMN.FULL_WIDTH,
      y1: CONFIG.Y_OFFSET + y1,
    }))

    // Combine all rectangles and annotate in one operation
    const allRectangles = [...leftRectangles, ...rightRectangles]
    await this.imageProcessor.annotateImage(imagePath, annotPath, allRectangles)
  }

  /**
   * Produces cropped PNG snippets for each detected vocabulary entry region in a column.
   * Skips any images that already exist.
   *
   * @param {string} imagePath - The file path to the original full-page image.
   * @param {number} pageNum - The current page number.
   * @param {Array<[number, number]>} ranges - The array of [y0, y1] break ranges for the column.
   * @param {'l'|'r'} column - The column identifier.
   * @returns {Promise<void>} A promise that resolves when all crop operations are complete.
   */
  async createCroppedImages(imagePath, pageNum, ranges, column) {
    const paddedPage = padPageNumber(pageNum)
    const columnConfig = column === 'l' ? CONFIG.LEFT_COLUMN : CONFIG.RIGHT_COLUMN

    for (let i = 0; i < ranges.length; i++) {
      const [y0, y1] = ranges[i]
      const outputPath = `${this.outputDir}/${paddedPage}-${column}-${i}.png`

      // Skip if already exists
      if (await fileExists(outputPath)) {
        continue
      }

      const cropWidth = columnConfig.CROP_WIDTH
      const cropHeight = y1 - y0
      const cropX = columnConfig.CROP_X
      const cropY = CONFIG.Y_OFFSET + y0

      await this.imageProcessor.cropRegion(
        imagePath,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        outputPath,
      )
    }
  }

  /**
   * Writes the final CSV output file for a given page's processed data.
   * Skips if the output file already exists.
   *
   * @param {Array<{definition: string, example: string}>} data - The processed vocabulary entries for the page.
   * @param {string} page - The page identifier string (e.g., "042") used for the filename.
   * @returns {Promise<void>} A promise that resolves when the file has been written.
   */
  async generateOutputs(data, page) {
    const csvFile = `${this.outputDir}/${page}.csv`

    // Skip if output already exists
    if (await fileExists(csvFile)) {
      return
    }

    console.log(`${page}: Generating CSV output...`)

    const csv = await this.dataProcessor.generateCSV(data, page)
    await fs.writeFile(csvFile, csv)
  }

  /**
   * Clean up resources such as the ImageProcessor’s worker pool.
   *
   * @returns {Promise<void>}
   */
  async destroy() {
    await this.imageProcessor.destroy()
  }
}
