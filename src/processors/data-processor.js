import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import { CONFIG } from '../config.js'

/**
 * @class DataProcessor
 * @description Handles the cleaning, normalization, and formatting of extracted vocabulary data.
 * This includes merging multi-line entries, applying text-based fixes, and generating final CSV output.
 */
export class DataProcessor {
  /**
   * Simple wrapper for processing raw and extracted data.
   */
  constructor() {}

  /**
   * Merges raw OCR entries into a buffer. If an entry has no definition,
   * its example text is appended to the example of the previous entry.
   * This is used to combine examples that span multiple detected regions.
   *
   * @param {Array<{definition: string, example: string}>} inputData - Newly extracted data items.
   * @param {Array<{definition: string, example: string}>} buf - The buffer of already processed items to append to.
   * @returns {Array<{definition: string, example: string}>} The updated buffer.
   */
  processRawData(inputData, buf) {
    for (const item of inputData) {
      const { definition, example } = item

      if (definition === '' && buf.length > 0) {
        // Merge with previous entry
        const prevItem = buf[buf.length - 1]
        prevItem.example = prevItem.example + '\n' + example
      } else {
        buf.push({
          definition: definition,
          example: example,
        })
      }
    }
    return buf
  }

  /**
   * Cleans up and filters raw entries to prepare them for final output.
   * This step processes the definition and example text separately.
   *
   * @param {Array<{definition: string, example: string}>} inputData - Raw, merged OCR results.
   * @returns {Promise<Array<{definition: string, example: string}>>} A promise that resolves to the cleaned entries.
   */
  async processExtractedData(inputData) {
    const processedData = []

    for (const item of inputData) {
      const { definition, example } = item

      // Skip entries with no example text
      if (example.trim() === '') continue

      processedData.push({
        definition: this.processDefinition(definition),
        example: this.processExample(example),
      })
    }

    return processedData
  }

  /**
   * Normalizes the definition text extracted from the PDF.
   * Applies a series of regex-based replacements to fix common formatting issues.
   *
   * @param {string} def - The raw definition string.
   * @returns {string} The cleaned and formatted definition.
   */
  processDefinition(def) {
    if (!def) return ''

    let processed = def

    // Fix newlines in definitions with "der ... die" pattern
    if (processed.match(/^der.*die/ms)) {
      processed = processed
        .replace(/\nder/g, '~der')
        .replace(/\ndie/g, '~die')
        .replace(/\n/g, ' ')
        .replace(/~der/g, '\nder')
        .replace(/~die/g, '\ndie')
    } else {
      processed = processed.replace(/\n/g, ' ')
    }

    // Fix up "der W, die Win, ..." -> "der W, -\ndie Win, ..."
    processed = processed.replace(/^der (.+?), die (.+?),\s+(.*?)(\s|$)/, 'der $1, -\ndie $2, $3 ')

    // Fix up nouns with "der ... / die ..."
    processed = processed.replace(/^(der\s+.*?)\s+\/\s+(die\s+.*?)/, '$1\n$2')

    // Fix up " → " -> "\n→ "
    processed = processed
      .replace(/\)→([ADC])/g, ') → $1')
      .replace(/\)→\s+/g, ')\n→ ')
      .replace(/\s+→\s+/g, '\n→ ')

    // Fix up "(A)" alone on line
    processed = processed.replace(/\n\s*(\((A|D|CH)(,\s+(A|D|CH))*\))\s*$/, ' $1')

    // Apply specific cosmetic fixes
    processed = this.applyCosmeticFixes(processed)

    return processed.trim()
  }

  /**
   * Normalizes the example sentence or list of examples.
   * Applies various regex-based fixes for list formatting and other OCR errors.
   *
   * @param {string} example - The raw example text.
   * @returns {string} The cleaned and formatted example.
   */
  processExample(example) {
    if (!example) return ''

    let processed = example

    // Fix p. 39-r
    processed = processed.replace(
      /1 Auf dem Brief fehlt der Absender/,
      '1. Auf dem Brief fehlt der Absender',
    )

    // Fix up 11. Mai on p. 80
    processed = processed.replace(/11\. Mai/, '11~Mai')

    // Fix broken lists (item numbers in front)
    const listMatch = processed.match(/^(([0-9]\.\n)+)\n/ms)
    if (listMatch) {
      const listPart = listMatch[1]
      const itemCount = listPart.split('\n').length - 1
      processed = processed.substring(listMatch[0].length)
      const lines = processed.split('\n')

      for (let i = 0; i < itemCount && i < lines.length; i++) {
        lines[i] = `${i + 1}. ${lines[i]}`
      }
      processed = lines.join('\n')
    }

    // Fix up newlines in examples
    if (processed.match(/^\d+\./)) {
      // This is a list - process each item
      const items = processed.split(/^\d{1,2}\.\s*/m).slice(1)
      let startNum = 1
      const firstMatch = processed.match(/^(\d+)\./)
      if (firstMatch) {
        startNum = parseInt(firstMatch[1])
      }

      processed = items
        .map(item => item.trim().replace(/\n/g, ' '))
        .map((item, index) => `${startNum + index}. ${item}`)
        .join('\n')
    } else {
      // This is a sentence - replace newlines with spaces
      processed = processed.replace(/\n/g, ' ')
    }

    // Revert the 11~Mai from p. 80
    processed = processed.replace(/11~Mai/, '11. Mai')

    // Cosmetic fixes to examples
    processed = processed
      .replace(/Ding\? Damit/, 'Ding? - Damit')
      .replace(/Müller ist\? Nein/, 'Müller ist? - Nein')

    // Special handling for Hausfrau/Hausmann (p. 49)
    if (
      processed.includes('Hausfrau') &&
      processed.includes('Hausmann') &&
      processed.includes('kümmert')
    ) {
      processed = processed.replace(/\//g, '\n')
    }

    return processed.trim()
  }

  /**
   * Applies a set of hardcoded textual tweaks for specific, known OCR errors.
   * These are fixes that are easier to perform programmatically than by manual override.
   *
   * @param {string} def - The input definition text.
   * @returns {string} The tweaked definition text.
   */
  applyCosmeticFixes(def) {
    return def
      .replace(/raus\(heraus/, 'raus- (heraus')
      .replace(/runter\(herunter/, 'runter- (herunter')
      .replace(/Kriminaldie Krimi/, 'Kriminal-\ndie Krimi')
      .replace(/Reception, en/, 'Reception, -en')
      .replace(/Serviceangestellte, n /, 'Serviceangestellte, -n ')
      .replace(/überübertreiben,/, 'über-\nübertreiben,')
      .replace(
        /festnehmen nimmt fest, nahm fest, hat festgenommen\./,
        'festnehmen, nimmt fest, nahm fest, hat festgenommen',
      )
  }

  /**
   * Retrieves the current git version string (`git describe`) with a hard 5 s timeout
   * powered by {@link AbortSignal.timeout}. Falls back to `"unknown"` on error.
   *
   * @returns {Promise<string>} Git version string or `'unknown'`.
   */
  async getGitVersion() {
    try {
      const git = spawn('git', ['describe', '--always', '--dirty'], {
        // Node-22 convenience: automatically aborts the child if it’s still running
        // after the given period, raising an AbortError we handle below.
        signal: AbortSignal.timeout(5_000),
      })

      let output = ''
      for await (const chunk of git.stdout) {
        output += chunk.toString()
      }

      return output.trim() || 'unknown'
    } catch {
      return 'unknown'
    }
  }

  /**
   * Creates CSV content from processed vocabulary entries.
   * The CSV includes a header with the git version and generation timestamp.
   *
   * @param {Array<{definition: string, example: string}>} data - The array of cleaned vocabulary entries.
   * @param {string|number} page - The page number or 'all', used for context (not in output).
   * @returns {Promise<string>} A promise that resolves to the full CSV content as a string.
   */
  async generateCSV(data, page) {
    const gitVersion = await this.getGitVersion()
    const generatedAt = new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    })

    let csv = `"Goethe Zertifikat B1 Wortliste","Version ${gitVersion} -- generated at ${generatedAt}"\n`

    for (const item of data) {
      const def = item.definition.replace(/"/g, '""')
      const example = item.example.replace(/"/g, '""')
      csv += `"${def}","${example}"\n`
    }

    return csv
  }
}
