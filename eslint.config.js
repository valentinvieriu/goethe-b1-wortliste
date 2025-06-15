export default [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      // Add any custom rules here
    },
  },
  {
    ignores: [
      'node_modules/**',
      'src/schemas/**',
      '**/*.html',
      '**/*.css',
      '**/*.md',
      'dist/**',
      'coverage/**',
    ],
  },
]
