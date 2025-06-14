# Goethe B1 Wortliste Extraction Project

This project extracts vocabulary data from the official Goethe-Zertifikat B1 Wortliste PDF and converts it into usable HTML and CSV formats for flashcard creation.

## Overview

The application processes a PDF document containing German vocabulary words with definitions and examples, extracting structured data through image processing and OCR techniques.

## Architecture

### Input
- `Goethe-Zertifikat_B1_Wortliste.pdf` - Source PDF (not included in repo)
- The PDF contains vocabulary pages with two-column layout (definitions on left, examples on right)

### Processing Pipeline
1. **PDF to PNG conversion** - Extract individual pages as high-res images
2. **Break detection** - Identify word boundaries in each column
3. **Annotation** - Mark detected regions for verification
4. **Text extraction** - OCR text from each identified region
5. **Data processing** - Clean and format extracted text
6. **Output generation** - Create HTML and CSV files

### Output Structure
All generated files are placed in `output/` directory:
- `output/Goethe-Zertifikat_B1_Wortliste-*.png` - Source page images
- `output/[page]-[col]-*.png` - Cropped word regions
- `output/[page]-[col].msh` - Marshaled extracted data
- `output/[page]-[col].txt` - Detected break points
- `output/[page]-annot.png` - Annotated pages showing detection regions
- `output/[page].html` - Individual page HTML output
- `output/[page].csv` - Individual page CSV output
- `output/all.html` - Combined HTML for all pages
- `output/all.csv` - Combined CSV for all pages

## Key Scripts

### Main Entry Points
- `make` or `./process-all.sh` - Process all pages (016-102)
- `./process-page.sh [page]` - Process single page
- `ruby generate.rb [page|all]` - Generate output files

### Core Scripts
- **process-all.sh** - Main orchestrator, extracts PDF pages and processes each
- **process-page.sh** - Single page processor (ranges → annotation → extraction → generation)
- **detect-breaks.rb** - Analyzes XPM images to find word boundaries
- **annotate.rb** - Draws rectangles on images to visualize detected regions
- **extract.rb** - Crops regions and extracts text via pdftotext
- **generate.rb** - Processes extracted data and generates final HTML/CSV

### Processing Flow
```
PDF → pdftocairo → PNG pages
PNG → convert → XPM crops → detect-breaks.rb → TXT ranges
TXT ranges → annotate.rb → annotated PNG
TXT ranges + PDF → extract.rb → MSH data + cropped PNGs
MSH data → generate.rb → HTML + CSV
```

## Dependencies

### System Requirements
- Ruby (with CSV, Marshal support)
- ImageMagick (`convert` command)
- Poppler utilities (`pdftocairo`, `pdftotext`)

### Docker Usage
The project includes a Dockerfile for consistent builds:
```bash
docker build -t goethe-b1 .
docker run --rm -v $(pwd):/app goethe-b1 make
```

## Text Processing Features

### Encoding Handling
- All Ruby scripts use UTF-8 encoding to handle German characters
- String encoding is explicitly set to prevent ASCII compatibility errors

### Text Cleanup
The `generate.rb` script includes extensive text processing:
- Fixes OCR errors in specific pages (e.g., page 39-r missing period)
- Handles date formatting (e.g., "11. Mai" → "11~Mai" → "11. Mai")
- Repairs broken list formatting
- Normalizes definition structures (der/die article patterns)
- Cosmetic fixes for specific vocabulary entries

### Output Formats
- **HTML**: Responsive table with German vocabulary and examples
- **CSV**: Two-column format suitable for flashcard applications like Anki

## Configuration

### Page Range
- Processes pages 016-102 (vocabulary section of the PDF)
- Pages are zero-padded (e.g., "016", "017")

### Column Detection
- Left column: definitions (x: 140-1200, cropped to 140-540 for text)
- Right column: examples (x: 1300-2340, cropped to 1300-1710 for text)
- Y offset: 320 pixels from top

### Break Detection
- Uses XPM format for pixel analysis
- Identifies horizontal white space gaps between vocabulary entries
- Handles special cases for specific pages with manual overrides

## Troubleshooting

### Common Issues
1. **Encoding errors**: All scripts now force UTF-8 encoding
2. **Missing convert**: Install ImageMagick
3. **Missing pdftotext**: Install poppler-utils
4. **CSV generation**: Fixed `generate_lines` → `generate_line` method

### File Structure
- Source PDF and generated PNGs should be in root directory
- All temporary and output files go in `output/` directory
- `.gitignore` excludes PDF, output directory
- `.dockerignore` excludes PDF, output directory for clean builds

## Development Notes

### Recent Refactoring
- Moved all temporary files to `output/` directory for cleaner builds
- Updated all scripts to use consistent output paths
- Simplified ignore files to only exclude `output/`

### Text Processing Edge Cases
- Page 79 has special handling for malformed OCR output
- Various cosmetic fixes for specific vocabulary entries
- HTML generation excludes image references (set to false)

## Usage Examples

Process everything:
```bash
make
# or
docker run --rm -v $(pwd):/app goethe-b1 make
```

Process single page:
```bash
./process-page.sh 042
ruby generate.rb 042
```

Generate combined output:
```bash
ruby generate.rb all
```

Clean and rebuild:
```bash
rm -rf output/
make
```