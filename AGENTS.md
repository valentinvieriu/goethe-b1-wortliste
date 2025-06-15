# Repository Overview

This repository extracts vocabulary entries from the **Goethe-Zertifikat B1 Wortliste** PDF and converts them into CSV/HTML files for flashcard creation.

**📖 For complete documentation, see [ai_docs/COMMON_GUIDE.md](ai_docs/COMMON_GUIDE.md)**

## Quick Start

**Recommended (Node.js):**

- `npm run process:all` - Process all pages (016-102)
- `npm run process:page 42` - Process single page
- `npm test` - Run test suite
- `npm run lint` - Run ESLint
- `npm run format` - Format with Prettier

**Legacy (Ruby):**

- `make` or `./process-all.sh` - Process all pages
- `./process-page.sh [page]` - Process single page

## Key Points for AI Agents

### Current Architecture

- **Primary**: Node.js 22 with `sharp` for image processing (75% faster than Ruby)
- **Legacy**: Ruby scripts with ImageMagick (still available)
- **Output**: 4,792 vocabulary entries from pages 16-102

### File Structure

```
src/                    # Node.js processors
├── index.js           # Main CLI entry point
├── config.js          # Break overrides for 19 special pages
└── processors/        # Core processing modules

*.rb, *.sh             # Legacy Ruby scripts
output/                # All generated files (gitignored)
```

### Processing Pipeline

1. PDF → PNG pages (parallel conversion)
2. Break detection → Text boundaries via pixel analysis
3. Text extraction → OCR via pdftotext
4. Data processing → Clean and format
5. Output generation → HTML/CSV files

### Development Notes

- Zero npm dependencies except `sharp`
- CPU-parallel processing across all cores
- JSON caching for faster reprocessing
- Extensive text cleanup for German vocabulary
- 19 page-specific override cases in break detection
- ESLint + Prettier + Husky for code quality

### Coding Conventions

- Node.js: Standard formatting
- Ruby: Two-space indentation
- All files use UTF-8 encoding for German characters
