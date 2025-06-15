import { test } from 'node:test'
import assert from 'node:assert'
import { DataProcessor } from '../src/processors/data-processor.js'

const processor = new DataProcessor()

test('processDefinition handles newlines correctly', () => {
  const input = 'der Test\ndie Tests'
  const result = processor.processDefinition(input)
  assert.strictEqual(result, 'der Test\ndie Tests')
})

test('processDefinition handles arrow formatting', () => {
  const input = 'test → Test'
  const result = processor.processDefinition(input)
  assert.strictEqual(result, 'test\n→ Test')
})

test('processExample handles numbered lists', () => {
  const input = '1. First item\n2. Second item'
  const result = processor.processExample(input)
  assert.strictEqual(result, '1. First item\n2. Second item')
})

test('processExample handles regular sentences', () => {
  const input = 'This is a\nregular sentence.'
  const result = processor.processExample(input)
  assert.strictEqual(result, 'This is a regular sentence.')
})

test('processExample applies page 39 fix', () => {
  const input = '1 Auf dem Brief fehlt der Absender'
  const result = processor.processExample(input)
  assert.strictEqual(result, '1. Auf dem Brief fehlt der Absender')
})

test('applyCosmeticFixes applies multiple fixes', () => {
  let result = processor.applyCosmeticFixes('raus(heraus test')
  assert.strictEqual(result, 'raus- (heraus test')

  result = processor.applyCosmeticFixes('Reception, en test')
  assert.strictEqual(result, 'Reception, -en test')
})

test('processRawData merges empty definitions', () => {
  const input = [
    { definition: 'test', example: 'example 1' },
    { definition: '', example: 'example 2' },
    { definition: 'test2', example: 'example 3' },
  ]

  const result = processor.processRawData(input, [])
  assert.strictEqual(result.length, 2)
  assert.strictEqual(result[0].example, 'example 1\nexample 2')
  assert.strictEqual(result[1].definition, 'test2')
})
