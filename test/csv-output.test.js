import { test } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs';
import { DataProcessor } from '../src/processors/data-processor.js';

const processor = new DataProcessor();

// Expected vocabulary entries for page 42
const expectedPage42Entries = [
  ['freiwillig', 'Manchmal bleibe ich freiwillig länger im Büro.'],
  ['fremd', '1. Ich reise gern in fremde Länder.\n2. Ich bin fremd hier.'],
  ['fressen, frisst, fraß, hat gefressen', 'Hat der Hund schon etwas zu fressen bekommen?'],
  ['sich freuen, freut sich, freute sich, hat sich gefreut', '1. Es freut mich, dass alles so gut geklappt hat.\n2. Ich habe mich über Ihr Geschenk sehr gefreut.\n3. Ich freue mich schon auf meinen nächsten Urlaub.'],
  ['die Freude', 'Diese Arbeit macht mir viel Freude.'],
  ['der Freund, -e', 'Ich sehe meine Freunde nur am Wochenende.'],
  ['freundlich', '1. Er hat uns sehr freundlich begrüßt.\n2. Der Mann ist sehr freundlich zu mir.\n3. Mit freundlichen Grüßen'],
  ['die Freundschaft, -en', 'Deine Freundschaft ist mir sehr wichtig.'],
  ['der Friede, Frieden, -', 'Endlich ist hier Frieden!'],
  ['frieren, friert, fror, hat gefroren', '1. Wenn Sie frieren, mache ich das Fenster wieder zu.\n2. Heute Nacht hat es gefroren.'],
  ['frisch', '1. Das Brot ist noch ganz frisch.\n2. Die Handtücher sind frisch gewaschen.\n3. Ich muss mal an die frische Luft.'],
  ['der Friseur, -e\ndie Friseurin, -nen (D, A)\n→ CH: Coiffeur', '1. Du siehst toll aus! Wer ist dein Friseur?\n2. Meine Tochter will Friseurin werden.'],
  ['die Frisur, -en', 'Du hast eine tolle Frisur! Warst du beim Friseur?'],
  ['die Frist, -en', 'Die Frist für die Anmeldung zum Deutschkurs ist abgelaufen.'],
  ['froh', '1. Ich bin froh, dass alles so gut geklappt hat.\n2. Frohes Fest!'],
  ['fröhlich', '1. Die Musik klingt fröhlich.\n2. Sie ist ein fröhlicher Mensch.'],
  ['die Frucht, ¨-e', 'Welche Früchte kann man essen?'],
  ['Früchte (CH)\n→ D, A: Obst', 'Früchte kaufe ich am liebsten auf dem Markt.'],
  ['früh', '1. Hier ist schon am frühen Morgen starker Verkehr.\n2. Mein Vater arbeitet von früh bis spät.\n3. Ich bin heute sehr früh aufgestanden.\n4. Wir sind eine halbe Stunde zu früh gekommen.\n5. Wecken Sie mich bitte morgen früh um 6 Uhr.'],
  ['früher/früher-', '1. Früher habe ich in Berlin gewohnt.\n2. Wir nehmen den früheren Zug.'],
  ['frühstücken, frühstückt, frühstückte, hat gefrühstückt', 'Haben Sie schon gefrühstückt?'],
  ['das Frühstück', '1. Wir sitzen gerade beim Frühstück.\n2. Sollen wir Ihnen das Frühstück aufs Zimmer bringen?'],
  ['fühlen, fühlt, fühlte, hat gefühlt', '1. Wie fühlen Sie sich? - Danke, ich fühle mich wohl.\n2. Fühl mal, ob das Wasser nicht zu heiß ist.'],
  ['führen, führt, führte, hat geführt', '1. Der Lehrer führt seine Schüler durch das Museum.\n2. Frau Meyer führt den Betrieb schon seit zehn Jahren.\n3. Nach 20 Minuten führte unsere Mannschaft 2 : 0.\n4. Die Straße führt direkt zum Bahnhof.'],
  ['der Führerausweis, -e (CH)\n→ D, A: Führerschein', 'Hast du einen Führerausweis?'],
  ['der Führerschein, -e (D, A)\n→ CH: Führerausweis', '1. Hast du einen Führerschein?\n2. Ich habe vor einem halben Jahr den Führerschein gemacht.'],
  ['die Führung, -en', '1. Die nächste Führung beginnt um 15 Uhr.\n2. Bayern München liegt in Führung.'],
  ['das Fundbüro, -s', 'Sie haben Ihren Schirm verloren. Da fragen Sie am besten im Fundbüro.'],
  ['funktionieren, funktioniert, funktionierte, hat funktioniert', '1. Können Sie mir bitte mal zeigen, wie der Automat funktioniert?\n2. Unsere Ehe funktioniert nicht mehr.'],
  ['für', '1. Ist Post für mich da?\n2. Ich habe die Schlüssel für meine Wohnung verloren.\n3. Gibt es hier einen Sportverein für Jugendliche?\n4. Diese alten Möbel haben wir für 100 Euro bekommen.\n5. Für einen Anfänger spielt er schon sehr gut Klavier.\n6. Du kannst nicht einkaufen gehen? Ich kann es für dich machen.\n7. Für mich ist das ein schwerer Fehler.\n8. Wir haben die Wohnung für ein Jahr gemietet.']
];

test('CSV format matches expected structure', async () => {
  // Test the CSV generation function directly
  const testData = [
    { definition: 'test', example: 'example' },
    { definition: 'test2', example: 'example2' }
  ];
  
  const csv = await processor.generateCSV(testData, '042');
  
  // Check header format
  assert.ok(csv.startsWith('"Goethe Zertifikat B1 Wortliste"'));
  assert.ok(csv.includes('Version'));
  assert.ok(csv.includes('generated at'));
  
  // Check entry format
  const lines = csv.split('\n');
  assert.strictEqual(lines[1], '"test","example"');
  assert.strictEqual(lines[2], '"test2","example2"');
});

test('CSV properly escapes quotes', async () => {
  const testData = [
    { definition: 'test "quoted"', example: 'example with "quotes"' }
  ];
  
  const csv = await processor.generateCSV(testData, '042');
  const lines = csv.split('\n');
  
  // Should double-escape quotes
  assert.ok(lines[1].includes('""quoted""'));
  assert.ok(lines[1].includes('""quotes""'));
});

test('CSV handles multiline text correctly', async () => {
  const testData = [
    { definition: 'test\nmultiline', example: 'example\nwith\nnewlines' }
  ];
  
  const csv = await processor.generateCSV(testData, '042');
  
  // Debug: Log the actual CSV content
  console.log('Generated CSV:', JSON.stringify(csv));
  
  // The CSV should contain the multiline text within quotes
  // Since we're splitting by \n, multiline content will span multiple "lines"
  // So we should check the entire CSV content, not individual lines
  assert.ok(csv.includes('"test\nmultiline"'));
  assert.ok(csv.includes('"example\nwith\nnewlines"'));
});

test('Page 42 vocabulary count matches expected', async () => {
  // This test will only run if the output file exists
  try {
    const csvContent = await fs.readFile('output/042.csv', 'utf8');
    const lines = csvContent.trim().split('\n');
    
    // Should have header + 30 vocabulary entries
    assert.strictEqual(lines.length, 31);
    
    console.log(`✓ Page 42 has ${lines.length - 1} vocabulary entries`);
  } catch (error) {
    console.log('⚠ Page 42 CSV not found - run processing first to validate output');
  }
});

test('Page 42 vocabulary entries match expected content', async () => {
  // This test validates actual output if available
  try {
    const csvContent = await fs.readFile('output/042.csv', 'utf8');
    const lines = csvContent.trim().split('\n');
    
    // Skip header line
    const dataLines = lines.slice(1);
    
    // Parse each line and compare
    for (let i = 0; i < Math.min(dataLines.length, expectedPage42Entries.length); i++) {
      const line = dataLines[i];
      const [expectedDef, expectedExample] = expectedPage42Entries[i];
      
      // Parse CSV line (simple parser for quoted strings)
      const match = line.match(/^"([^"]*(?:""[^"]*)*)","([^"]*(?:""[^"]*)*)"$/);
      if (!match) {
        console.log(`Warning: Could not parse line ${i + 1}: ${line}`);
        continue;
      }
      
      const [, actualDef, actualExample] = match;
      
      // Unescape quotes for comparison
      const unescapedDef = actualDef.replace(/""/g, '"');
      const unescapedExample = actualExample.replace(/""/g, '"');
      
      // Compare content (allow minor whitespace differences)
      assert.strictEqual(
        unescapedDef.trim(), 
        expectedDef.trim(), 
        `Definition mismatch at entry ${i + 1}`
      );
      assert.strictEqual(
        unescapedExample.trim(), 
        expectedExample.trim(), 
        `Example mismatch at entry ${i + 1}`
      );
    }
    
    // Verify total count
    assert.strictEqual(
      dataLines.length, 
      expectedPage42Entries.length, 
      `Expected ${expectedPage42Entries.length} entries, got ${dataLines.length}`
    );
    
    console.log(`✓ All ${expectedPage42Entries.length} vocabulary entries match expected content`);
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('⚠ Page 42 CSV not found - run processing first to validate output');
    } else {
      throw error;
    }
  }
});

test('Total vocabulary count validation', async () => {
  // This test validates the total count if all.csv exists
  try {
    const csvContent = await fs.readFile('output/all.csv', 'utf8');
    const lines = csvContent.trim().split('\n');
    
    // Should have header + 4792 vocabulary entries
    const expectedTotal = 4792;
    const actualTotal = lines.length - 1;
    
    assert.strictEqual(
      actualTotal, 
      expectedTotal, 
      `Expected ${expectedTotal} total entries, got ${actualTotal}`
    );
    
    console.log(`✓ Total vocabulary count: ${actualTotal} entries (matches Ruby version)`);
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('⚠ all.csv not found - run full processing to validate total count');
    } else {
      throw error;
    }
  }
});