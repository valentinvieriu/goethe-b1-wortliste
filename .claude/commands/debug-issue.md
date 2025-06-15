Debug a specific issue with the PDF processing pipeline:

Issue: $ARGUMENTS

1. Analyze the problem description and identify affected components
2. Check relevant code sections in src/index.js and processors/ directory
3. Look for similar issues in existing test cases
4. Examine output/ directory for intermediate files (.json, .png, .txt)
5. Run single page processing for debugging: `npm run process:page 42`
6. Check break detection overrides in src/config.js if page-specific
7. Verify text extraction and data processing steps
8. Suggest specific fixes with code examples
9. Add tests to prevent regression
