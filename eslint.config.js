import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Google Sheets has no "update where id = x": every write reads the tab to
    // resolve a row index, then writes to it. Two of those interleaving means
    // the second acts on an index that has already shifted, overwriting or
    // deleting a neighbouring row. The helpers in services/google/sheets.ts
    // serialize each read-then-write pair per tab; a raw fetch here skips that
    // queue, and the damage only shows up under concurrent edits — long after
    // the code that caused it looked fine in review.
    files: ['src/services/api/**/*.ts', 'src/hooks/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': ['error', {
        name: 'fetch',
        message: 'Do not call the Sheets API directly from this layer. Use the exported helpers in services/google/sheets.ts (they serialize writes per tab), or apiFetch from services/google/http.ts for non-Sheets requests.',
      }],
    },
  },
])
