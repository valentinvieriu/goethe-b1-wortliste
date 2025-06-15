# Goethe B1 Wortliste Extraction Project

This project extracts vocabulary data from the official Goethe-Zertifikat B1 Wortliste PDF and converts it into usable HTML and CSV formats for flashcard creation.

## Overview

The application processes a PDF document containing German vocabulary words with definitions and examples, extracting structured data through image processing and OCR techniques.

**Note: This project has been refactored to use Node.js 22 with zero external _npm_ dependencies (besides `sharp` for image processing). The original Ruby version is still available but the Node.js version is now the recommended approach.**

## Architecture

### Input

- `Goethe-Zertifikat_B1_Wortliste.pdf` - Source PDF (not included in repo)
- The PDF contains vocabulary pages with two-column layout (definitions on left, examples on right)

### Processing Pipeline

1. **PDF to PNG conversion (parallel)** - Extract individual pages as high-res images concurrently across all CPU cores
2. **Break detection** - Identify word boundaries in each column (using raw pixel data from `sharp`)
3. **Annotation** - Mark detected regions for verification (using `sharp`)
4. **Text extraction** - OCR text from each identified region
5. **Data processing** - Clean and format extracted text
6. **CSV generation** - Create CSV files as single source of truth
7. **Client-side HTML** - JavaScript-based interface reads CSV files for display

### Output Structure

All generated files are placed in `output/` directory:

- `output/Goethe-Zertifikat_B1_Wortliste-*.png` - Source page images
- `output/[page]-[col]-*.png` - Cropped word regions
- `output/[page]-[col].json` - Extracted data (Node.js) or `.msh` (Ruby)
- `output/[page]-[col].txt` - Detected break points
- `output/[page]-annot.png` - Annotated pages showing detection regions
- `output/[page].csv` - Individual page CSV output
- `output/all.csv` - Combined CSV for all pages (single source of truth)
- `output/index.html` - Client-side HTML interface (reads CSV files)

## Usage (Node.js Version - Recommended)

### Main Commands

- `npm run process:all` - Process all pages (016-102)
- `npm run process:page 42` - Process single page
- `npm test` - Run test suite
- `npm run clean` - Clean output directory
- `npm run lint` - Run ESLint on src/ and test/
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format all files with Prettier
- `npm run format:check` - Check if files are formatted correctly

### Direct Node.js Usage

```bash
node src/index.js --all              # Process all pages
node src/index.js --page 42          # Process single page
node src/index.js --help             # Show usage help
```

### Node.js Architecture

```
src/
├── client/
│   ├── index.html          # Client-side HTML interface
│   └── ui.js               # Client-side JavaScript logic
├── index.js                # Main CLI entry point and orchestration
├── config.js               # Configuration constants and break overrides
├── utils/fs.js             # File system utilities and helpers
└── processors/
    ├── pdf-converter.js    # PDF to PNG conversion via MuPDF.js
    ├── image-processor.js  # sharp operations (crop, annotate)
    ├── break-detector.js   # Pixel analysis for text boundaries
    ├── text-extractor.js   # Coordinate-based OCR via MuPDF.js
    ├── data-processor.js   # Text cleaning and CSV generation
    └── page-processor.js   # Page-level orchestration and caching
```

### Key Implementation Details

**Break Detection**: Implements the exact Ruby finite state machine for analyzing XPM pixel data to find vocabulary entry boundaries. Handles 19 page-specific override cases.

**Text Processing**: Preserves all Ruby text cleaning logic including German article formatting, numbered list repairs, and 15+ cosmetic fixes for specific vocabulary entries.

**Caching Strategy**: Individual page data stored as JSON files (`042-l.json`, `042-r.json`) for faster reprocessing and debugging.

**Error Recovery**: Continues processing other pages if one fails, with detailed error reporting and graceful degradation.

### Performance Comparison (Node.js vs Ruby)

| Metric           | Ruby Version    | Node.js Version     | Improvement      |
| ---------------- | --------------- | ------------------- | ---------------- |
| Processing Speed | ~25-30 min      | ~6-8 min            | 75 % faster      |
| Memory Usage     | ~300-400MB      | ~100-200MB          | 50% less         |
| Error Handling   | Stop on failure | Continue processing | More robust      |
| Caching          | Marshal files   | JSON files          | Better debugging |
| Dependencies     | Ruby + gems     | Node.js only        | Simpler setup    |

### Vocabulary Count Verification

Both versions produce exactly **4792 vocabulary entries** across pages 16-102, ensuring complete accuracy and compatibility.

### Single-Source Architecture (Refactored)

The system has been refactored to use **CSV as the single source of truth**:

- **Processing**: Only generates CSV files during extraction and processing.
- **HTML Interface**: A static HTML file (`src/client/index.html`) and its corresponding JavaScript (`src/client/ui.js`) are copied to the `output/` directory. The JavaScript dynamically reads the CSV files for display.
- **Benefits**:
  - Eliminates data inconsistencies between HTML and CSV.
  - Faster processing (no server-side HTML generation).
  - Simpler deployment (just serve static files).
  - CSV files can be used directly in other applications.
- **Usage**: Open `output/index.html` in a browser to view the interactive interface.

## Legacy Ruby Scripts (Still Available)

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
PNG (via sharp) → Raw Pixel Data → detect-breaks → TXT ranges
TXT ranges + PNG (via sharp) → annotated PNG
TXT ranges + PDF → extract.rb → JSON data + cropped PNGs
JSON data → generate.js → HTML + CSV
```

## Dependencies

### Node.js Version (Recommended)

- Node.js 22 or higher
- `sharp` (npm package for image processing)
- `mupdf` (npm package for PDF processing)

### Ruby Version (Legacy)

- Ruby (with CSV, Marshal support)
- ImageMagick (`convert` command)
- Poppler utilities (`pdftocairo`, `pdftotext`)

### Docker Usage

The project includes a Dockerfile for consistent builds:

**Node.js version (default):**

```bash
docker build -t goethe-b1 .
docker run --rm -v $(pwd):/app goethe-b1
```

**Override for specific commands:**

```bash
docker run --rm -v $(pwd):/app goethe-b1 npm run process:page 42
docker run --rm -v $(pwd):/app goethe-b1 npm test
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

- **CSV**: Two-column format suitable for flashcard applications like Anki (single source of truth)
- **HTML**: Client-side responsive interface that reads CSV data for display and search

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

### Code Quality

- **ESLint**: Configured for modern JavaScript with ES modules
- **Prettier**: Enforces consistent code formatting
- **Husky**: Pre-commit hooks run linting and formatting automatically
- **lint-staged**: Only lints changed files for faster commits

### Recent Refactoring

- Added CPU-parallel rendering and page processing (leverages all available cores)
- Moved all temporary files to `output/` directory for cleaner builds
- Updated all scripts to use consistent output paths
- Simplified ignore files to only exclude `output/`
- Integrated ESLint, Prettier, and Husky for code quality

### Text Processing Edge Cases

- Page 79 has special handling for malformed OCR output
- Various cosmetic fixes for specific vocabulary entries
- HTML generation excludes image references (set to false)

## Usage Examples

### Node.js Version

Process everything:

```bash
npm run process:all
# or with Docker
docker run --rm -v $(pwd):/app goethe-b1
```

Process single page:

```bash
npm run process:page 42
# or
node src/index.js --page 42
```

Run tests:

```bash
npm test
```

Clean and rebuild:

```bash
npm run clean
npm run process:all
```

### Ruby Version (Legacy)

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
