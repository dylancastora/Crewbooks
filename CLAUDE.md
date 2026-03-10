# CrewBooks

Vite + React 19 + TypeScript + Tailwind CSS v4 PWA. Uses Google Sheets as the database (one spreadsheet per user workspace).

## Schema Conformance

The database lives in Google Sheets. Existing users' spreadsheets must be migrated when we add or rename columns. We handle this with a **schema conformance system** that runs automatically on login.

### How it works

`conformSchema()` in `src/services/api/conform.ts` runs **before** data is loaded (called in `src/context/DataProvider.tsx`). It:

1. Reads current headers from each tab that has migrations defined
2. Compares against the expected columns in the `migrations` array
3. If all columns already exist, returns immediately (no-op — no performance cost)
4. For tabs with missing columns, inserts them at the correct position, fills default values for every existing row, and writes back the entire tab in a single Sheets API `values:update` PUT

### Checklist: Adding a new column

Any change that alters the data schema **must** touch all of these:

1. **`src/services/api/conform.ts`** — Add a `SchemaMigration` entry to the `migrations` array:
   ```ts
   { tab: 'Jobs', column: 'myNewField', afterColumn: 'existingColumn', defaultValue: '' }
   ```
   `defaultValue` can be a string or a function `(row, context) => string` for computed defaults. If the function needs data from another tab, add it to `MigrationContext`.

2. **`src/services/api/init.ts`** — Add the column to the `TABS` object so new workspaces get it from the start. If the feature has a user-configurable default, add a row to `DEFAULT_SETTINGS`.

3. **`src/types/index.ts`** — Add the field to the relevant TypeScript interface (e.g. `Job`, `Client`).

4. **Tab API file** (e.g. `src/services/api/jobs.ts`) — Add to the `*_HEADERS` array, update `rowTo*` to parse the value, and update `create*` to include a sensible default.

### Key files

| File | Role |
|---|---|
| `src/services/api/conform.ts` | Migration definitions + `conformSchema()` |
| `src/services/api/init.ts` | `TABS` (canonical column lists), `DEFAULT_SETTINGS` |
| `src/types/index.ts` | TypeScript interfaces for all data types |
| `src/services/api/jobs.ts` | Jobs tab: headers, parser, create/update |
| `src/services/api/clients.ts` | Clients + Contacts tabs |
| `src/services/api/expenses.ts` | Expenses tab |
| `src/services/api/communications.ts` | Communications tab |
| `src/services/api/jobItems.ts` | JobItems tab |
| `src/context/DataProvider.tsx` | Calls `conformSchema()` before loading data |
