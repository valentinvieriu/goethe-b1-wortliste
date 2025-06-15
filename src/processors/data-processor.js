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

    let html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width" />
<title>${pageTitle} :: Goethe Zertifikat B1 Wortliste</title>
<style>
      table { border: 2px solid black; border-collapse: collapse; }
      table th { border: 1px solid #aaa; padding: 0.2em 0.5em; }
      table th:not([colspan]) { border-bottom: 2px solid black; }
      table td { text-align: left; border: 1px solid #aaa; padding: 0.2em 0.5em; }
      p { max-width: 800px; }
</style>
</head>
<body>
<h1>Goethe Zertifikat B1 Wortliste</h1>
<p>Version ${gitVersion} -- generated at ${generatedAt}</p>
<p>
All of this text is extracted from
<a href="${CONFIG.PDF_URL}">${CONFIG.PDF_FILE}</a>
(© 2016 Goethe-Institut und ÖSD)
because their PDF was unusable for making flashcards.
</p>
<p>
I elaborated on <a href="https://wejn.org/2023/12/extracting-data-from-goethe-zertifikat-b1-wortliste/">the extraction process</a>
on my blog.
</p>
<p>
It is highly likely you can use this for personal purposes, but I make no claim
that I own the resulting data. In other words: if I were you, I wouldn't go
using this in any commercial capacity.
</p>
<h2>${pageTitle}</h2>
<table>
<tr><th>Def</th><th>Example</th></tr>`

    for (const item of data) {
      const def = item.definition.replace(/\n/g, '<br />\n')
      const example = item.example.replace(/\n/g, '<br />\n')
      html += `<tr><td>${def}</td><td>${example}</td></tr>`
    }

    if (!isAllPages) {
      const pageNum = parseInt(page)
      const prevPage = pageNum - 1
      const nextPage = pageNum + 1

      html += '<tr>'
      if (pageNum === 16) {
        html += '<th>&nbsp;</th>'
      } else {
        const prevPageStr = prevPage.toString().padStart(3, '0')
        html += `<th><a href="${prevPageStr}.html">page ${prevPageStr}</a></th>`
      }

      if (pageNum === 102) {
        html += '<th>&nbsp;</th>'
      } else {
        const nextPageStr = nextPage.toString().padStart(3, '0')
        html += `<th><a href="${nextPageStr}.html">page ${nextPageStr}</a></th>`
      }
      html += '</tr>'
    }

    html += `</table>
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
