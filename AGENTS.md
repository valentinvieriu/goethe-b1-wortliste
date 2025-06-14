# Repository Overview

This repository extracts vocabulary entries from the **Goethe-Zertifikat B1 Wortliste** PDF and turns them into CSV/HTML files. The original PDF is not included (it is listed in `.gitignore`).

The processing pipeline uses Ruby scripts together with ImageMagick and `pdftotext`/`pdftocairo` utilities. The main entry point is `make` which calls `process-all.sh`.


## Detailed extraction steps

The workflow mirrors [the extraction blog post](https://wejn.org/2023/12/extracting-data-from-goethe-zertifikat-b1-wortliste/). It processes the PDF at **300 dpi** and assumes constant coordinates:

- **Y range:** 320..3260
- **Column 1:** x=140..540
- **Column 2:** x=540..1200
- **Column 3:** x=1300..1710
- **Column 4:** x=1710..2340

Running `make` performs the following:
1. Convert pages to PNGs via `pdftocairo`.
2. `process-page.sh` crops column groups and saves them as XPM.
3. `detect-breaks.rb` finds long whitespace (threshold around 42 px) to define entry rectangles. Overrides handle special pages.
4. `annotate.rb` draws red rectangles for inspection.
5. `extract.rb` runs `pdftotext` on each rectangle, storing results in `.msh` files.
6. `generate.rb` merges fragments, cleans formatting, and outputs page HTML/CSV or an `all` file.

The overrides and cleanup rules were iteratively improved by running the scripts and checking `git diff` (diff-driven development).


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
