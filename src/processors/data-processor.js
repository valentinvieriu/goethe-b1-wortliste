import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import { CONFIG } from '../config.js'

export class DataProcessor {
  constructor() {}

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

  async generateHTML(data, page) {
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

    const isAllPages = page === 'all'
    const pageTitle = isAllPages ? 'Pages 16..102' : `Page ${parseInt(page)}`

    let prevPageStr = ''
    let nextPageStr = ''

    if (!isAllPages) {
      const pageNum = parseInt(page)
      const prevPage = pageNum - 1
      const nextPage = pageNum + 1

      if (pageNum !== 16) {
        prevPageStr = prevPage.toString().padStart(3, '0')
      }

      if (pageNum !== 102) {
        nextPageStr = nextPage.toString().padStart(3, '0')
      }
    }

    const dataJson = JSON.stringify(data).replace(/</g, '\u003c')

    const html =
      `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${pageTitle} :: Goethe Zertifikat B1 Wortliste</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="p-4">
    <div id="app"></div>
    <script type="application/json" id="data">${dataJson}</script>
    <script type="module">
      import { html, render } from 'https://unpkg.com/lit-html?module'

      const data = JSON.parse(document.getElementById('data').textContent)
      const gitVersion = '${gitVersion}'
      const generatedAt = '${generatedAt}'
      const pageTitle = '${pageTitle}'
      const isAllPages = ${isAllPages}
      const prevPageStr = '${prevPageStr}'
      const nextPageStr = '${nextPageStr}'

      let filter = ''

      const update = () => {
        const filtered = data.filter(
          item =>
            item.definition.toLowerCase().includes(filter) ||
            item.example.toLowerCase().includes(filter),
        )

      const template = html\`
          <div class="max-w-4xl mx-auto">
            <h1 class="text-2xl font-bold mb-2">Goethe Zertifikat B1 Wortliste</h1>
            <p>Version \${gitVersion} -- generated at \${generatedAt}</p>
            <h2 class="text-xl font-semibold mt-4">\${pageTitle}</h2>
            <input
              type="text"
              placeholder="Search..."
              class="border p-2 my-4 w-full"
              @input=${e => {
                filter = e.target.value.toLowerCase()
                update()
              }}
            />
            <p class="mb-2">\${filtered.length} entries</p>
            <table class="table-auto border-collapse w-full text-left">
              <thead>
                <tr>
                  <th class="border px-2 py-1">Def</th>
                  <th class="border px-2 py-1">Example</th>
                </tr>
              </thead>
              <tbody>
                \${filtered.map(
                  item =>
                    html\`<tr>
                      <td class="border px-2 py-1 whitespace-pre-line">\${item.definition}</td>
                      <td class="border px-2 py-1 whitespace-pre-line">\${item.example}</td>
                    </tr>\`,
                )}
                \${
                  !isAllPages
                    ? html\`<tr>
                        <th class="border px-2 py-1">
                            \${prevPageStr
                              ? html\`<a href="\${prevPageStr}.html">page \${prevPageStr}</a>\`
                              : html` & nbsp
    ;`}
                        </th>
                        <th class="border px-2 py-1">
                            \${nextPageStr
                              ? html\`<a href="\${nextPageStr}.html">page \${nextPageStr}</a>\`
                              : html` & nbsp
    ;`}
                        </th>
                      </tr>\`
                    : html``
                }
              </tbody>
            </table>
            <p class="mt-4 max-w-prose">
              All of this text is extracted from
              <a href="${CONFIG.PDF_URL}">${CONFIG.PDF_FILE}</a>
              (© 2016 Goethe-Institut und ÖSD) because their PDF was unusable for
              making flashcards.
            </p>
            <p class="max-w-prose">
              I elaborated on
              <a href="https://wejn.org/2023/12/extracting-data-from-goethe-zertifikat-b1-wortliste/">
                the extraction process
              </a>
              on my blog.
            </p>
            <p class="max-w-prose">
              It is highly likely you can use this for personal purposes, but I
              make no claim that I own the resulting data. In other words: if I
              were you, I wouldn't go using this in any commercial capacity.
            </p>
          </div>
        \`
        render(template, document.getElementById('app'))
      }

      update()
    </script>
  </body>
</html>`

    return html
  }

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
