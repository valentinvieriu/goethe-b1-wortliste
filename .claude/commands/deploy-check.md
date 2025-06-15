Perform a comprehensive processing readiness check:

1. Run `npm run lint` to check for linting issues
2. Run `npm run format:check` to verify code formatting (fix with `npm run format` if needed)
3. Run `npm test` to ensure all tests pass
4. Verify Node.js 22+ is installed and sharp package is available
5. Check that Goethe-Zertifikat_B1_Wortliste.pdf exists in root
6. Verify output/ directory has processed files or is ready for processing
7. Test single page processing: `npm run process:page 42`
8. Confirm no sensitive data in source code
9. Check that all .claude/commands are up to date

Note: Project uses MuPDF.js (WASM) for PDF processing - no external dependencies like pdftocairo/pdftotext needed.
