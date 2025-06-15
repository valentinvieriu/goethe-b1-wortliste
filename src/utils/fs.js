import { promises as fs } from 'fs'
import { dirname } from 'path'

/**
 * Ensure that the directory for the given file path exists.
 *
 * @param {string} path - Path whose directory should be created.
 * @returns {Promise<void>} Resolves when the directory exists.
 */
export async function ensureDir(path) {
  try {
    await fs.mkdir(dirname(path), { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error
    }
  }
}

/**
 * Test whether a file exists on disk.
 *
 * @param {string} path - Path to the file.
 * @returns {Promise<boolean>} True when the file is accessible.
 */
export async function fileExists(path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Read and parse a JSON file.
 *
 * @param {string} path - File location.
 * @returns {Promise<any>} Parsed JSON data.
 */
export async function readJSON(path) {
  const content = await fs.readFile(path, 'utf8')
  return JSON.parse(content)
}

/**
 * Write JSON data to a file, creating directories when necessary.
 *
 * @param {string} path - Destination path.
 * @param {any} data - Data to be serialized.
 * @returns {Promise<void>} Resolves when the file is written.
 */
export async function writeJSON(path, data) {
  await ensureDir(path)
  await fs.writeFile(path, JSON.stringify(data, null, 2))
}

/**
 * Format page numbers as three-digit strings.
 *
 * @param {number} num - Page number to format.
 * @returns {string} Zero-padded representation.
 */
export function padPageNumber(num) {
  return num.toString().padStart(3, '0')
}
