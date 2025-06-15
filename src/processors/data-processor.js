import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import { CONFIG } from '../config.js'

export class DataProcessor {
  /**
   * Simple wrapper for processing raw and extracted data.
   */
  constructor() {}

  /**
   * Merge raw OCR entries into a buffer, combining examples that
   * span multiple lines.
   *
   * @param {Array<{definition:string,example:string}>} inputData - Newly extracted data.
   * @param {Array<{definition:string,example:string}>} buf - Buffer to append to.
   * @returns {Array<{definition:string,example:string}>} Updated buffer.
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
   * Clean up and filter raw entries to prepare them for output.
   *
   * @param {Array<{definition:string,example:string}>} inputData - Raw OCR results.
   * @returns {Promise<Array<{definition:string,example:string}>>} Cleaned entries.
   */
  async processExtractedData(inputData) {
    const processedData = []

    for (const item of inputData) {
      const { definition, example } = item

      // Skip empty examples
      if (example.trim() === '') continue

      processedData.push({
        definition: this.processDefinition(definition),
        example: this.processExample(example),
      })
    }

    return processedData
  }

  /**
   * Normalize the definition text extracted from the PDF.
   *
   * @param {string} def - Raw definition string.
   * @returns {string} Cleaned definition.
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
   * Normalize the example sentence or list.
   *
   * @param {string} example - Raw example text.
   * @returns {string} Cleaned example.
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
   * Apply a set of textual tweaks that are easier to perform
   * programmatically than by hand.
   *
   * @param {string} def - Input definition text.
   * @returns {string} Tweaked definition text.
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
   * Retrieve the current git version string for inclusion in outputs.
   *
   * @returns {Promise<string>} Git describe output or 'unknown'.
   */
  async getGitVersion() {
    return new Promise(resolve => {
      const git = spawn('git', ['describe', '--always', '--dirty'], {
        timeout: 5000, // 5 second timeout
      })
      let output = ''
      let resolved = false

      const cleanup = result => {
        if (!resolved) {
          resolved = true
          if (timeoutId) clearTimeout(timeoutId)
          resolve(result)
        }
      }

      git.stdout.on('data', data => {
        output += data.toString()
      })

      git.on('close', () => {
        cleanup(output.trim() || 'unknown')
      })

      git.on('error', () => {
        cleanup('unknown')
      })

      // Fallback timeout
      const timeoutId = setTimeout(() => {
        git.kill()
        cleanup('unknown')
      }, 6000)
    })
  }

  /**
   * Generate the client-side HTML interface that reads CSV files.
   *
   * @returns {Promise<string>} HTML content for the client-side interface.
   */
  async generateClientHTML() {
    const html = `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Goethe Zertifikat B1 Wortliste</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              'goethe-blue': '#005AA0',
              'goethe-light': '#E8F4FD'
            }
          }
        }
      }
    </script>
  </head>
  <body class="bg-gray-50 min-h-screen">
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      <div id="app">
        <div class="bg-white rounded-lg shadow-lg overflow-hidden text-center py-12">
          <div class="text-goethe-blue">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-goethe-blue mx-auto mb-4"></div>
            <h1 class="text-xl font-medium">Loading vocabulary data...</h1>
          </div>
        </div>
      </div>
    </div>

    <script>

      let allData = []
      let filteredData = []
      let filter = ''
      let metadata = { version: '', generatedAt: '' }
      let currentPage = 'all'

      const parseCSV = (csvText) => {
        // Split into lines but allow empty lines; we'll reconstruct records
        const lines = csvText.split('\\n');
        const data = [];
        let metadata = {};
        if (lines.length === 0) return { data: [], metadata };

        // Parse header line for metadata
        const headerMatch = lines[0].match(/^"([^"]+)","Version ([^"]+)"$/);
        if (headerMatch) {
          metadata = {
            title: headerMatch[1],
            version: headerMatch[2]
          };
          lines.shift(); // Remove header
        }

        let record = '';
        // Helper to parse one complete CSV record string
        const processRecord = (rec) => {
          const fields = [];
          let current = '';
          let inQuotes = false;
          for (let j = 0; j < rec.length; j++) {
            const ch = rec[j], nextCh = rec[j+1];
            if (ch === '"') {
              if (inQuotes && nextCh === '"') {
                current += '"';
                j++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (ch === ',' && !inQuotes) {
              fields.push(current);
              current = '';
            } else {
              current += ch;
            }
          }
          fields.push(current);
          if (fields.length >= 2) {
            data.push({
              definition: fields[0],
              example: fields[1]
            });
          }
        };

        // Accumulate lines until we have balanced quotes
        for (const line of lines) {
          record = record ? record + '\\n' + line : line;
          const quoteCount = (record.match(/"/g) || []).length;
          if (quoteCount % 2 === 0) {
            if (record.trim()) processRecord(record);
            record = '';
          }
        }

        return { data, metadata };
      }

      const updateFilter = (newFilter) => {
        filter = newFilter.toLowerCase()
        filteredData = allData.filter(
          item =>
            item.definition.toLowerCase().includes(filter) ||
            item.example.toLowerCase().includes(filter),
        )
        document.getElementById('app').innerHTML = generateTemplate()
      }

      const generateTemplate = () => {
        const pageOptions = Array.from({length: 87}, (_, i) => {
          const pageNum = i + 16;
          const selected = currentPage == pageNum ? 'selected' : '';
          return \`<option value="\${pageNum}" \${selected}>Page \${pageNum}</option>\`;
        }).join('');

        const tableRows = filteredData.map((item, index) => {
          const bgClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
          return \`
            <tr class="\${bgClass} hover:bg-blue-50 transition-colors">
              <td class="px-6 py-4 text-sm text-gray-900 whitespace-pre-line align-top leading-relaxed">
                \${escapeHtml(item.definition)}
              </td>
              <td class="px-6 py-4 text-sm text-gray-700 whitespace-pre-line align-top leading-relaxed">
                \${escapeHtml(item.example)}
              </td>
            </tr>
          \`;
        }).join('');

        const noResults = filteredData.length === 0 && filter ? \`
          <div class="px-6 py-12 text-center">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.441.935-6 2.461m0 0V21m6-6h.01M6 21h12a2 2 0 002-2V5a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
            <h3 class="mt-4 text-lg font-medium text-gray-900">No entries found</h3>
            <p class="mt-2 text-gray-500">Try adjusting your search terms.</p>
          </div>
        \` : \`
          <table class="w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                  Definition
                </th>
                <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                  Example
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              \${tableRows}
            </tbody>
          </table>
        \`;

        return \`
          <div class="bg-white rounded-lg shadow-lg overflow-hidden">
            <!-- Header -->
            <div class="bg-goethe-blue text-white px-6 py-8">
              <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="flex-1">
                  <h1 class="text-3xl md:text-4xl font-bold mb-2">Goethe Zertifikat B1 Wortliste</h1>
                  <p class="text-goethe-light text-sm opacity-90">\${escapeHtml(metadata.version)}</p>
                  <h2 class="text-xl md:text-2xl font-semibold mt-4 text-white">
                    \${currentPage === 'all' ? 'Pages 16-102 (Complete)' : \`Page \${parseInt(currentPage)}\`}
                  </h2>
                </div>
                <div class="text-right">
                  <label for="page-select" class="block text-sm font-medium text-goethe-light mb-2">Select Page</label>
                  <select 
                    id="page-select" 
                    class="px-3 py-2 border border-goethe-light rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-white focus:border-white"
                    onchange="loadPage(this.value)"
                  >
                    <option value="all" \${currentPage === 'all' ? 'selected' : ''}>All Pages</option>
                    \${pageOptions}
                  </select>
                </div>
              </div>
            </div>

            <!-- Search and Stats -->
            <div class="px-6 py-6 bg-goethe-light border-b">
              <div class="flex flex-col md:flex-row md:items-center gap-4">
                <div class="flex-1">
                  <label for="search" class="block text-sm font-medium text-gray-700 mb-2">Search vocabulary</label>
                  <div class="relative">
                    <input
                      id="search"
                      type="text"
                      placeholder="Search definitions and examples..."
                      class="w-full px-4 py-3 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-goethe-blue focus:border-goethe-blue transition-colors"
                      oninput="updateFilter(this.value)"
                      value="\${escapeHtml(filter)}"
                    />
                    <svg class="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                </div>
                <div class="text-center md:text-right">
                  <div class="text-2xl font-bold text-goethe-blue">\${filteredData.length}</div>
                  <div class="text-sm text-gray-600">\${filteredData.length === 1 ? 'entry' : 'entries'}</div>
                  \${filter ? \`<div class="text-xs text-gray-500 mt-1">of \${allData.length} total</div>\` : ''}
                </div>
              </div>
            </div>

            <!-- Table -->
            <div class="overflow-x-auto">
              \${noResults}
            </div>

            <!-- Footer -->
            <div class="px-6 py-6 bg-gray-50 border-t space-y-3 text-sm text-gray-600">
              <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="space-y-2">
                  <p>
                    All text extracted from
                    <a href="${CONFIG.PDF_URL}" class="text-goethe-blue hover:underline font-medium">${CONFIG.PDF_FILE}</a>
                    (© 2016 Goethe-Institut und ÖSD) for flashcard creation.
                  </p>
                  <p>
                    Read about
                    <a href="https://wejn.org/2023/12/extracting-data-from-goethe-zertifikat-b1-wortliste/" class="text-goethe-blue hover:underline font-medium">
                      the extraction process
                    </a>
                    on the developer's blog.
                  </p>
                </div>
                <div class="text-right">
                  <a 
                    href="all.csv" 
                    download="goethe-b1-wortliste.csv"
                    class="inline-flex items-center px-4 py-2 text-sm font-medium text-goethe-blue hover:bg-goethe-blue hover:text-white transition-colors rounded-md border border-goethe-blue"
                  >
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Download CSV
                  </a>
                </div>
              </div>
              <p class="text-xs text-gray-500">
                For personal use only. Commercial use of this data is not recommended.
              </p>
            </div>
          </div>
        \`;
      }

      const escapeHtml = (text) => {
        if (!text) return '';
        return text.replace(/[&<>"']/g, (match) => {
          const escape = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
          };
          return escape[match];
        });
      }

      const loadPage = async (page) => {
        currentPage = page
        const csvFile = page === 'all' ? 'all.csv' : \`\${page.padStart(3, '0')}.csv\`
        
        // Show loading state
        document.getElementById('app').innerHTML = \`
          <div class="bg-white rounded-lg shadow-lg overflow-hidden text-center py-12">
            <div class="text-goethe-blue">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-goethe-blue mx-auto mb-4"></div>
              <h1 class="text-xl font-medium">Loading \${page === 'all' ? 'all pages' : 'page ' + page}...</h1>
            </div>
          </div>
        \`
        
        try {
          const response = await fetch(csvFile)
          if (!response.ok) {
            throw new Error(\`HTTP \${response.status}: \${response.statusText}\`)
          }
          const csvText = await response.text()
          console.log(\`Loaded \${csvFile}, text length: \${csvText.length}\`)
          
          const { data, metadata: meta } = parseCSV(csvText)
          console.log(\`Parsed \${data.length} entries from \${csvFile}\`)
          
          allData = data
          filteredData = data
          metadata = meta
          filter = '' // Reset filter when changing pages
          
          console.log('Data sample:', data.slice(0, 2))
          console.log('Metadata:', metadata)
          console.log('Current page:', currentPage)
          
          console.log('About to render template...')
          try {
            const appElement = document.getElementById('app')
            console.log('App element:', appElement)
            console.log('App element HTML before render:', appElement.innerHTML.substring(0, 100))
            
            console.log('Rendering template with vanilla JS...')
            appElement.innerHTML = generateTemplate()
            console.log('Template rendered successfully')
            console.log('App element HTML after render:', appElement.innerHTML.substring(0, 200))
          } catch (templateError) {
            console.error('Template error:', templateError)
            document.getElementById('app').innerHTML = \`
              <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                <div class="bg-red-100 border border-red-400 text-red-700 px-6 py-8 text-center">
                  <h1 class="text-2xl font-bold mb-2">Template Error</h1>
                  <p>Template rendering failed: \${templateError.message}</p>
                  <pre class="text-xs mt-2 text-left">\${templateError.stack}</pre>
                </div>
              </div>
            \`
          }
        } catch (error) {
          console.error('Failed to load vocabulary data:', error)
          document.getElementById('app').innerHTML = \`
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
              <div class="bg-red-100 border border-red-400 text-red-700 px-6 py-8 text-center">
                <h1 class="text-2xl font-bold mb-2">Error Loading Data</h1>
                <p>Failed to load vocabulary data: \${error.message}</p>
                <p class="text-sm mt-2">Make sure the \${csvFile} file is available.</p>
                <p class="text-xs mt-2 text-gray-600">Check browser console for details.</p>
              </div>
            </div>
          \`
        }
      }

      const template = () => html\`
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
          <!-- Header -->
          <div class="bg-goethe-blue text-white px-6 py-8">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div class="flex-1">
                <h1 class="text-3xl md:text-4xl font-bold mb-2">Goethe Zertifikat B1 Wortliste</h1>
                <p class="text-goethe-light text-sm opacity-90">\${metadata.version}</p>
                <h2 class="text-xl md:text-2xl font-semibold mt-4 text-white">
                  \${currentPage === 'all' ? 'Pages 16-102 (Complete)' : \`Page \${parseInt(currentPage)}\`}
                </h2>
              </div>
              <div class="text-right">
                <label for="page-select" class="block text-sm font-medium text-goethe-light mb-2">Select Page</label>
                <select 
                  id="page-select" 
                  class="px-3 py-2 border border-goethe-light rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-white focus:border-white"
                  @change=\${e => loadPage(e.target.value)}
                  .value=\${currentPage}
                >
                  <option value="all">All Pages</option>
                  \${Array.from({length: 87}, (_, i) => {
                    const pageNum = i + 16;
                    return html\`<option value="\${pageNum}">Page \${pageNum}</option>\`
                  })}
                </select>
              </div>
            </div>
          </div>

          <!-- Search and Stats -->
          <div class="px-6 py-6 bg-goethe-light border-b">
            <div class="flex flex-col md:flex-row md:items-center gap-4">
              <div class="flex-1">
                <label for="search" class="block text-sm font-medium text-gray-700 mb-2">Search vocabulary</label>
                <div class="relative">
                  <input
                    id="search"
                    type="text"
                    placeholder="Search definitions and examples..."
                    class="w-full px-4 py-3 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-goethe-blue focus:border-goethe-blue transition-colors"
                    @input=\${e => updateFilter(e.target.value)}
                    .value="\${filter}"
                  />
                  <svg class="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
              </div>
              <div class="text-center md:text-right">
                <div class="text-2xl font-bold text-goethe-blue">\${filteredData.length}</div>
                <div class="text-sm text-gray-600">\${filteredData.length === 1 ? 'entry' : 'entries'}</div>
                \${filter ? html\`<div class="text-xs text-gray-500 mt-1">of \${allData.length} total</div>\` : ''}
              </div>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            \${filteredData.length === 0 && filter ? html\`
              <div class="px-6 py-12 text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.441.935-6 2.461m0 0V21m6-6h.01M6 21h12a2 2 0 002-2V5a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
                <h3 class="mt-4 text-lg font-medium text-gray-900">No entries found</h3>
                <p class="mt-2 text-gray-500">Try adjusting your search terms.</p>
              </div>
            \` : html\`
              <table class="w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                      Definition
                    </th>
                    <th class="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                      Example
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  \${filteredData.map((item, index) => html\`
                    <tr class="\${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors">
                      <td class="px-6 py-4 text-sm text-gray-900 whitespace-pre-line align-top leading-relaxed">
                        \${item.definition}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-700 whitespace-pre-line align-top leading-relaxed">
                        \${item.example}
                      </td>
                    </tr>
                  \`)}
                </tbody>
              </table>
            \`}
          </div>

          <!-- Footer -->
          <div class="px-6 py-6 bg-gray-50 border-t space-y-3 text-sm text-gray-600">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div class="space-y-2">
                <p>
                  All text extracted from
                  <a href="${CONFIG.PDF_URL}" class="text-goethe-blue hover:underline font-medium">${CONFIG.PDF_FILE}</a>
                  (© 2016 Goethe-Institut und ÖSD) for flashcard creation.
                </p>
                <p>
                  Read about
                  <a href="https://wejn.org/2023/12/extracting-data-from-goethe-zertifikat-b1-wortliste/" class="text-goethe-blue hover:underline font-medium">
                    the extraction process
                  </a>
                  on the developer's blog.
                </p>
              </div>
              <div class="text-right">
                <a 
                  href="all.csv" 
                  download="goethe-b1-wortliste.csv"
                  class="inline-flex items-center px-4 py-2 text-sm font-medium text-goethe-blue hover:bg-goethe-blue hover:text-white transition-colors rounded-md border border-goethe-blue"
                >
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  Download CSV
                </a>
              </div>
            </div>
            <p class="text-xs text-gray-500">
              For personal use only. Commercial use of this data is not recommended.
            </p>
          </div>
        </div>
      \`

      // Initialize - load all pages by default
      loadPage('all')
    </script>
  </body>
</html>`

    return html
  }

  /**
   * Create CSV output from processed vocabulary entries.
   *
   * @param {Array<{definition:string,example:string}>} data - Cleaned entries.
   * @param {string|number} page - Page number or 'all'.
   * @returns {Promise<string>} CSV content.
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
