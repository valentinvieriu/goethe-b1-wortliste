import { promises as fs } from 'fs'
import { dirname } from 'path'

export async function ensureDir(path) {
  try {
    await fs.mkdir(dirname(path), { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error
    }
  }
}

export async function fileExists(path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

export async function readJSON(path) {
  const content = await fs.readFile(path, 'utf8')
  return JSON.parse(content)
}

export async function writeJSON(path, data) {
  await ensureDir(path)
  await fs.writeFile(path, JSON.stringify(data, null, 2))
}

export function padPageNumber(num) {
  return num.toString().padStart(3, '0')
}
