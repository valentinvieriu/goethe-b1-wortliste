Perform a comprehensive processing readiness check:

1. Run `npm run lint` to check for linting issues
2. Run `npm run format:check` to verify code formatting
3. Run `npm test` to ensure all tests pass
4. Verify all dependencies are installed (Node.js 22, pdftocairo, pdftotext)
5. Check that Goethe-Zertifikat_B1_Wortliste.pdf exists in root
6. Verify output/ directory structure is clean
7. Test single page processing: `npm run process:page 42`
8. Confirm no sensitive data in source code
