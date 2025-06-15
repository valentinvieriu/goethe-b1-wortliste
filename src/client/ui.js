const PDF_URL =
  'https://web.archive.org/web/20250601000000/https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf'
const PDF_FILE = 'Goethe-Zertifikat_B1_Wortliste.pdf'

let allData = []
let filteredData = []
let filter = ''
let metadata = { version: '', generatedAt: '' }
let currentPage = 'all'

const parseCSV = csvText => {
  // Split into lines but allow empty lines; we'll reconstruct records
  const lines = csvText.split('\n')
  const data = []
  let metadata = {}
  if (lines.length === 0) return { data: [], metadata }

  // Parse header line for metadata
  const headerMatch = lines[0].match(/^"([^"]+)","Version ([^"]+)"$/)
  if (headerMatch) {
    metadata = {
      title: headerMatch[1],
      version: headerMatch[2],
    }
    lines.shift() // Remove header
  }

  let record = ''
  // Helper to parse one complete CSV record string
  const processRecord = rec => {
    const fields = []
    let current = ''
    let inQuotes = false
    for (let j = 0; j < rec.length; j++) {
      const ch = rec[j],
        nextCh = rec[j + 1]
      if (ch === '"') {
        if (inQuotes && nextCh === '"') {
          current += '"'
          j++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current)
    if (fields.length >= 2) {
      data.push({
        definition: fields[0],
        example: fields[1],
      })
    }
  }

  // Accumulate lines until we have balanced quotes
  for (const line of lines) {
    record = record ? record + '\n' + line : line
    const quoteCount = (record.match(/"/g) || []).length
    if (quoteCount % 2 === 0) {
      if (record.trim()) processRecord(record)
      record = ''
    }
  }

  return { data, metadata }
}

const updateFilter = newFilter => {
  filter = newFilter.toLowerCase()
  filteredData = allData.filter(
    item =>
      item.definition.toLowerCase().includes(filter) || item.example.toLowerCase().includes(filter),
  )
  document.getElementById('app').innerHTML = generateTemplate()
}

const generateTemplate = () => {
  const pageOptions = Array.from({ length: 87 }, (_, i) => {
    const pageNum = i + 16
    const selected = currentPage == pageNum ? 'selected' : ''
    return `<option value="${pageNum}" ${selected}>Page ${pageNum}</option>`
  }).join('')

  const tableRows = filteredData
    .map((item, index) => {
      const bgClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
      return `
            <tr class="${bgClass} hover:bg-blue-50 transition-colors">
              <td class="px-6 py-4 text-sm text-gray-900 whitespace-pre-line align-top leading-relaxed">
                ${escapeHtml(item.definition)}
              </td>
              <td class="px-6 py-4 text-sm text-gray-700 whitespace-pre-line align-top leading-relaxed">
                ${escapeHtml(item.example)}
              </td>
            </tr>
          `
    })
    .join('')

  const noResults =
    filteredData.length === 0 && filter
      ? `
          <div class="px-6 py-12 text-center">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.441.935-6 2.461m0 0V21m6-6h.01M6 21h12a2 2 0 002-2V5a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
            <h3 class="mt-4 text-lg font-medium text-gray-900">No entries found</h3>
            <p class="mt-2 text-gray-500">Try adjusting your search terms.</p>
          </div>
        `
      : `
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
              ${tableRows}
            </tbody>
          </table>
        `

  return `
          <div class="bg-white rounded-lg shadow-lg overflow-hidden">
            <!-- Header -->
            <div class="bg-goethe-blue text-white px-6 py-8">
              <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="flex-1">
                  <h1 class="text-3xl md:text-4xl font-bold mb-2">Goethe Zertifikat B1 Wortliste</h1>
                  <p class="text-goethe-light text-sm opacity-90">${escapeHtml(metadata.version)}</p>
                  <h2 class="text-xl md:text-2xl font-semibold mt-4 text-white">
                    ${currentPage === 'all' ? 'Pages 16-102 (Complete)' : `Page ${parseInt(currentPage)}`}
                  </h2>
                </div>
                <div class="text-right">
                  <label for="page-select" class="block text-sm font-medium text-goethe-light mb-2">Select Page</label>
                  <select
                    id="page-select"
                    class="px-3 py-2 border border-goethe-light rounded-md bg-white text-gray-900 focus:ring-2 focus:ring-white focus:border-white"
                    onchange="loadPage(this.value)"
                  >
                    <option value="all" ${currentPage === 'all' ? 'selected' : ''}>All Pages</option>
                    ${pageOptions}
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
                      value="${escapeHtml(filter)}"
                    />
                    <svg class="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                </div>
                <div class="text-center md:text-right">
                  <div class="text-2xl font-bold text-goethe-blue">${filteredData.length}</div>
                  <div class="text-sm text-gray-600">${filteredData.length === 1 ? 'entry' : 'entries'}</div>
                  ${filter ? `<div class="text-xs text-gray-500 mt-1">of ${allData.length} total</div>` : ''}
                </div>
              </div>
            </div>

            <!-- Table -->
            <div class="overflow-x-auto">
              ${noResults}
            </div>

            <!-- Footer -->
            <div class="px-6 py-6 bg-gray-50 border-t space-y-3 text-sm text-gray-600">
              <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="space-y-2">
                  <p>
                    All text extracted from
                    <a href="${PDF_URL}" class="text-goethe-blue hover:underline font-medium">${PDF_FILE}</a>
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
        `
}

const escapeHtml = text => {
  if (!text) return ''
  return text.replace(/[&<>"']/g, match => {
    const escape = {
      '&': '&',
      '<': '<',
      '>': '>',
      '"': '"',
      "'": "'",
    }
    return escape[match]
  })
}

const loadPage = async page => {
  currentPage = page
  const csvFile = page === 'all' ? 'all.csv' : `${page.padStart(3, '0')}.csv`

  // Show loading state
  document.getElementById('app').innerHTML = `
          <div class="bg-white rounded-lg shadow-lg overflow-hidden text-center py-12">
            <div class="text-goethe-blue">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-goethe-blue mx-auto mb-4"></div>
              <h1 class="text-xl font-medium">Loading ${page === 'all' ? 'all pages' : 'page ' + page}...</h1>
            </div>
          </div>
        `

  try {
    const response = await fetch(csvFile)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const csvText = await response.text()
    const { data, metadata: meta } = parseCSV(csvText)

    allData = data
    filteredData = data
    metadata = meta
    filter = '' // Reset filter when changing pages

    document.getElementById('app').innerHTML = generateTemplate()
  } catch (error) {
    console.error('Failed to load vocabulary data:', error)
    document.getElementById('app').innerHTML = `
            <div class="bg-white rounded-lg shadow-lg overflow-hidden">
              <div class="bg-red-100 border border-red-400 text-red-700 px-6 py-8 text-center">
                <h1 class="text-2xl font-bold mb-2">Error Loading Data</h1>
                <p>Failed to load vocabulary data: ${error.message}</p>
                <p class="text-sm mt-2">Make sure the ${csvFile} file is available.</p>
                <p class="text-xs mt-2 text-gray-600">Check browser console for details.</p>
              </div>
            </div>
          `
  }
}

// Initialize - load all pages by default
document.addEventListener('DOMContentLoaded', () => {
  loadPage('all')
})
