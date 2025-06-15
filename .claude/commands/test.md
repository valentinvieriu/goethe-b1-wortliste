Run the project's test suite and code quality checks:

1. Run `npm run lint` to check for linting issues (fix with `npm run lint:fix`)
2. Run `npm run format:check` to verify code formatting (fix with `npm run format`)
3. Execute `npm test` to run all unit tests and integration tests
4. If any checks fail, analyze the output and suggest specific fixes
5. Verify test coverage includes break detection, data processing, and output validation
6. Run single page test if needed: `npm run process:page 42`
7. Check that all processor modules have corresponding test coverage
