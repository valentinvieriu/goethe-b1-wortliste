# Goethe B1 Wortliste - Node.js Version

This is a complete Node.js 22 refactor of the original Ruby-based Goethe B1 Wortliste extraction project. It processes the official Goethe-Zertifikat B1 Wortliste PDF and converts it into usable HTML and CSV formats for flashcard creation.

## Features

- **Pure Node.js 22**: Uses native Node.js modules wherever possible
- **Zero external dependencies**: No npm packages required beyond Node.js built-ins
- **ESM modules**: Modern JavaScript module system
- **Comprehensive tests**: Minimal but effective test coverage
- **Same functionality**: Maintains all features from the original Ruby version

## Requirements

- Node.js 22 or higher
- System dependencies:
  - `pdftocairo` (from poppler-utils)
  - `pdftotext` (from poppler-utils) 
  - `convert` (from ImageMagick)

## Project Structure

```
src/
├── index.js                 # Main entry point and CLI
├── config.js               # Configuration and constants
├── utils/
│   └── fs.js               # File system utilities
└── processors/
    ├── pdf-converter.js    # PDF to PNG conversion
    ├── image-processor.js  # Image cropping and annotation
    ├── break-detector.js   # Text break detection in images
    ├── text-extractor.js   # OCR text extraction
    ├── data-processor.js   # Text cleaning and output generation
    └── page-processor.js   # Page-level orchestration

test/                       # Test files
```

## Usage

### Process all pages (16-102):
```bash
npm run process:all
# or
node src/index.js --all
```

### Process a single page:
```bash
npm run process:page 42
# or  
node src/index.js --page 42
```

### Run tests:
```bash
npm test
```

### Clean output:
```bash
npm run clean
```

### Docker usage:
```bash
# Build the Docker image
docker build -t goethe-b1 .

# Run processing (processes all pages by default)
docker run --rm -v $(pwd)/output:/app/output goethe-b1

# Process a specific page
docker run --rm -v $(pwd)/output:/app/output goethe-b1 npm run process:page 42

# Run tests
docker run --rm goethe-b1 npm test

# Interactive shell access
docker run --rm -it goethe-b1 bash
```

## Processing Pipeline

1. **PDF Conversion**: Extract pages as high-resolution PNG images using `pdftocairo`
2. **Break Detection**: Analyze XMP crops to identify word boundaries using pixel analysis
3. **Annotation**: Create annotated images showing detected regions
4. **Text Extraction**: Use `pdftotext` to extract text from specific page regions
5. **Data Processing**: Clean and format extracted text with extensive post-processing
6. **Output Generation**: Create HTML and CSV files for individual pages and combined output

## Output Files

All files are generated in the `output/` directory:

- `output/Goethe-Zertifikat_B1_Wortliste-*.png` - Source page images
- `output/[page]-[col]-*.png` - Cropped word regions  
- `output/[page]-[col].json` - Extracted data per column
- `output/[page]-[col].txt` - Detected break points
- `output/[page]-annot.png` - Annotated pages
- `output/[page].html` - Individual page HTML
- `output/[page].csv` - Individual page CSV
- `output/all.html` - Combined HTML for all pages
- `output/all.csv` - Combined CSV for all pages

## Key Differences from Ruby Version

- **No Marshal files**: Uses JSON for data serialization instead of Ruby Marshal
- **Better error handling**: Comprehensive error handling throughout the pipeline
- **Modern JavaScript**: Uses async/await, ES modules, and Node.js 22 features
- **Simplified architecture**: Cleaner separation of concerns with dedicated processor classes
- **Native dependencies only**: No external npm packages required

## Text Processing Features

The Node.js version maintains all the original text processing capabilities:

- OCR error corrections for specific pages
- German character handling with proper UTF-8 encoding
- Definition and example text cleanup
- List formatting repairs
- Article pattern normalization (der/die)
- Cosmetic fixes for vocabulary entries

## Development

The codebase follows modern Node.js best practices:

- ES modules with `import/export`
- Async/await for all asynchronous operations
- Native Node.js APIs (`fs.promises`, `child_process`, etc.)
- Minimal but effective test coverage using Node.js built-in test runner
- Clear separation of concerns with dedicated processor classes

## Troubleshooting

1. **Missing system dependencies**: Install poppler-utils and ImageMagick
2. **Permission errors**: Ensure write access to project directory
3. **Memory issues**: Large PDF processing may require increased Node.js memory limit

The refactor maintains 100% compatibility with the original output while providing a more maintainable and modern codebase.