# Repository Overview

This repository extracts vocabulary entries from the **Goethe-Zertifikat B1 Wortliste** PDF and turns them into CSV/HTML files. The original PDF is not included (it is listed in `.gitignore`).

The processing pipeline uses Ruby scripts together with ImageMagick and `pdftotext`/`pdftocairo` utilities. The main entry point is `make` which calls `process-all.sh`.

## Directory structure

- `process-all.sh` – processes the whole PDF. Converts the PDF to individual PNG pages (using `pdftocairo`), then iterates over the pages and calls `process-page.sh` for each page.
- `process-page.sh` – runs the pipeline for a single page: cropping, detecting line breaks, drawing annotations, extracting text, and generating per-page CSV/HTML outputs.
- `annotate.rb` – draws rectangles on cropped page images to visualise detected text areas.
- `detect-breaks.rb` – scans XPM images for long whitespace areas to determine vertical break positions. Contains page-specific overrides for tricky pages.
- `extract.rb` – extracts text from rectangular regions of the PDF using `pdftotext`. The results are stored in marshal (`.msh`) files for later processing.
- `generate.rb` – combines the extracted data, performs various clean-ups, and produces `*.html` and `*.csv` files. Passing `all` as the argument merges all pages.
- `Makefile` – running `make` simply invokes `./process-all.sh`.
- `.gitignore` – ignores the original PDF, intermediate PNGs, marshal files and generated outputs.
- `LICENSE` – the project is released under the AGPL 3.0.

## Running the pipeline

1. Place `Goethe-Zertifikat_B1_Wortliste.pdf` in the repository root (it is not tracked).
2. Ensure `ruby`, `pdftocairo`, `pdftotext` and `convert` (ImageMagick) are installed.
3. Run `make` to process all pages and generate combined `all.html` and `all.csv`.
   Individual per-page outputs will also be created (e.g. `016.html`, `016.csv`).

## Coding conventions

- Ruby code uses two-space indentation.
- Shell scripts are indented with two spaces.
- Makefiles use tab characters for command lines.

There are no automated tests in this repository.
