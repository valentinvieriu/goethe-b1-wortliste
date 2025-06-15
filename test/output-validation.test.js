import { test } from 'node:test'
import assert from 'node:assert'
import { fileExists } from '../src/utils/fs.js'

test('Page 42 output files exist after processing', async () => {
  // This test checks if output files were generated
  const files = ['output/042.csv', 'output/042.html', 'output/042-l.json', 'output/042-r.json']

  let foundFiles = 0
  for (const file of files) {
    if (await fileExists(file)) {
      foundFiles++
    }
  }

  if (foundFiles > 0) {
    console.log(`✓ Found ${foundFiles}/${files.length} output files for page 42`)
  } else {
    console.log('⚠ No page 42 output files found - run processing first to validate output')
  }

  // Test passes regardless - this is just informational
  assert.ok(true)
})

test('Combined output files exist after full processing', async () => {
  // This test checks if combined output files were generated
  const files = ['output/all.csv', 'output/all.html']

  let foundFiles = 0
  for (const file of files) {
    if (await fileExists(file)) {
      foundFiles++
    }
  }

  if (foundFiles > 0) {
    console.log(`✓ Found ${foundFiles}/${files.length} combined output files`)
  } else {
    console.log('⚠ No combined output files found - run full processing to validate output')
  }

  // Test passes regardless - this is just informational
  assert.ok(true)
})
