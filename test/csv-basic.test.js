import { test } from 'node:test'
import assert from 'node:assert'
import { DataProcessor } from '../src/processors/data-processor.js'

test('CSV format matches expected structure', async () => {
  // Test the CSV generation function directly
  const processor = new DataProcessor()
  const testData = [
    { definition: 'test', example: 'example' },
    { definition: 'test2', example: 'example2' },
  ]

  const csv = await processor.generateCSV(testData, '042')

  // Check header format
  assert.ok(csv.startsWith('"Goethe Zertifikat B1 Wortliste"'))
  assert.ok(csv.includes('Version'))
  assert.ok(csv.includes('generated at'))

  // Check entry format
  const lines = csv.split('\n')
  assert.strictEqual(lines[1], '"test","example"')
  assert.strictEqual(lines[2], '"test2","example2"')
})

test('CSV properly escapes quotes', async () => {
  const processor = new DataProcessor()
  const testData = [{ definition: 'test "quoted"', example: 'example with "quotes"' }]

  const csv = await processor.generateCSV(testData, '042')
  const lines = csv.split('\n')

  // Should double-escape quotes
  assert.ok(lines[1].includes('""quoted""'))
  assert.ok(lines[1].includes('""quotes""'))
})

test('CSV handles multiline text correctly', async () => {
  const processor = new DataProcessor()
  const testData = [{ definition: 'test\nmultiline', example: 'example\nwith\nnewlines' }]

  const csv = await processor.generateCSV(testData, '042')

  // The CSV should contain the multiline text within quotes
  assert.ok(csv.includes('"test\nmultiline"'))
  assert.ok(csv.includes('"example\nwith\nnewlines"'))
})
