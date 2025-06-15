import { promises as fs } from 'fs'
import { CONFIG } from '../config.js'
import { PDFConverter } from './pdf-converter.js'
import { ImageProcessor } from './image-processor.js'
import { BreakDetector } from './break-detector.js'
import { TextExtractor } from './text-extractor.js'
import { DataProcessor } from './data-processor.js'
import { fileExists, padPageNumber } from '../utils/fs.js'

export class PageProcessor {
  /**
   * Processor orchestrating all steps for a single PDF page.
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
   * Process an individual page of the PDF from image extraction to HTML/CSV.
   *
   * @param {number} pageNum - 1-based page number.
   * @returns {Promise<Array<{definition:string,example:string}>>} Processed entries.
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
   * Process a single column of a page: detect breaks, extract text and images.
   *
   * @param {string} imagePath - PNG path for the whole page.
   * @param {number} pageNum - Page number being processed.
   * @param {'l'|'r'} column - Column identifier.
   * @returns {Promise<{data:Array, ranges:Array}>} Extracted data and ranges.
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
   * Generate a single annotated image showing break ranges for both columns.
   *
   * @param {string} imagePath - Path to the original page PNG.
   * @param {number} pageNum - Current page number.
   * @param {Array<Array<number>>} leftRanges - Break ranges for the left column.
   * @param {Array<Array<number>>} rightRanges - Break ranges for the right column.
   * @returns {Promise<void>} Resolves when the annotation is written.
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
   * Produce cropped PNG snippets for each detected region.
   *
   * @param {string} imagePath - Original page image.
   * @param {number} pageNum - Page number.
   * @param {Array<Array<number>>} ranges - Break ranges of the column.
   * @param {'l'|'r'} column - Column identifier.
   * @returns {Promise<void>} Resolves when all crops are written.
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
   * Write HTML and CSV output files for a page.
   *
   * @param {Array} data - Processed entries for the page.
   * @param {string} page - Page identifier used for filenames.
   * @returns {Promise<void>} Resolves when files are written.
   */
  async generateOutputs(data, page) {
    const htmlFile = `${this.outputDir}/${page}.html`
    const csvFile = `${this.outputDir}/${page}.csv`

    // Skip if outputs already exist
    if ((await fileExists(htmlFile)) && (await fileExists(csvFile))) {
      return
    }

    console.log(`${page}: Generating outputs...`)

    const html = await this.dataProcessor.generateHTML(data, page)
    const csv = await this.dataProcessor.generateCSV(data, page)

    await fs.writeFile(htmlFile, html)
    await fs.writeFile(csvFile, csv)
  }
}
