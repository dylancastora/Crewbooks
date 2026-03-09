# CrewBooks: Google Sheets API Rate Limiting Bug

## Problem

The app intermittently shows zero data (no jobs, clients, expenses, rates, etc.) within 1-3 minutes of use. The Google Sheets API returns **429 Too Many Requests** errors, which appear dozens of times in the browser console. No data is lost — the data still exists in Google Sheets — but the app cannot read it because Google is rejecting the requests.

## Root Cause

**Each page independently fetches all its data on mount, and duplicate hook instances double the requests.** Each React hook (`useJobs()`, `useClients()`, etc.) is an independent instance that makes its own Google Sheets API request on mount. Several pages call the same hooks multiple times — once directly, and again indirectly via `useJobActions()`. Every page navigation tears down all hooks and creates new ones, re-fetching everything from scratch.

### How `useJobActions()` multiplies requests

`useJobActions()` (src/hooks/useJobActions.ts) internally calls six data hooks:

| Hook called inside useJobActions | API requests |
|---|---|
| `useJobs()` | 1 |
| `useClients()` | 1 (batchGet for Clients + Contacts) |
| `useSettings()` | 1 |
| `useCommunications()` | 1 |
| `useJobItems()` | 1 |
| `useExpenses()` | 1 |

That's **6 requests** just from `useJobActions()`.

### DashboardPage: 12 requests per load

```
useClients()          → 1 request  (instance #1)
useJobActions()       → 6 requests (contains useJobs#1, useClients#2, useSettings#1,
                                     useCommunications#1, useJobItems#1, useExpenses#1)
useJobItems()         → 1 request  (instance #2 — duplicate of the one inside useJobActions)
useCommunications()   → 1 request  (instance #2 — duplicate)
useJobs()             → 1 request  (instance #2 — duplicate)
useExpenses()         → 1 request  (instance #2 — duplicate)
OnboardingPrompt
  └─ useSettings()    → 1 request  (instance #2 — duplicate)
                        ──────────
                        12 total
```

The direct hooks on lines 18-25 of DashboardPage.tsx are only used for their `loading` state — the actual data comes from `useJobActions()`. But because each hook call is an independent instance, they each fire their own API request.

### JobsPage: 11 requests per load

```
useClients()          → 1 request  (instance #1)
useJobActions()       → 6 requests (same 6 internal hooks)
useJobItems()         → 1 request  (duplicate)
useCommunications()   → 1 request  (duplicate)
useExpenses()         → 1 request  (duplicate)
OnboardingPrompt
  └─ useSettings()    → 1 request  (duplicate)
                        ──────────
                        11 total
```

### Navigation compounds the problem

Every time the user navigates between pages, all hooks unmount and remount, firing fresh API calls. Navigating from Dashboard (12 requests) to Jobs (11 requests) to a Job Detail page (7 requests) fires **30 requests** within seconds. Google's per-user rate limit for the Sheets API is **60 read requests per minute**. Normal app usage easily exceeds this.

### Full page-load request counts

| Page | Unique hooks needed | Duplicate instances | Total API requests |
|---|---|---|---|
| Dashboard | 6 | 6 | **12** |
| Jobs | 6 | 5 | **11** |
| Job Detail | 5 | 1 (OnboardingPrompt) | **7** |
| Clients | 3 | 1 (OnboardingPrompt) | **4** |
| Expenses | 3 | 1 (OnboardingPrompt) | **4** |
| Rates | 1 | 1 (OnboardingPrompt) | **3** |
| Settings | 1 | 1 (OnboardingPrompt) | **1** |

## Proposed Solution

**Replace per-page data fetching with a shared DataProvider context** that loads each dataset once at the app level and shares it across all pages. This eliminates both the duplicate-instance problem and the re-fetch-on-navigation problem.

### How it works

1. A new `DataProvider` component wraps the authenticated portion of the app (inside `AuthGate`, alongside `AppShell`).
2. On mount, it fetches each dataset once: Jobs, Clients/Contacts, Settings, Expenses, JobItems, Communications, Rates.
3. It exposes the data, loading states, and mutation functions via React context.
4. All pages and hooks consume data from this shared context instead of making their own API calls.
5. When a page navigates, no new API calls are made — the data is already in memory.

### Request counts after the fix

| Action | Before | After |
|---|---|---|
| Initial login / page load | 7-12 | **8** (one per sheet tab) |
| Navigate to any page | 3-12 | **0** |
| Dashboard → Jobs → Job Detail | 30 | **8** (initial load only) |
| 10 page navigations in 1 minute | 30-120 | **8** |

The 8 initial requests are: Jobs, Clients (batchGet with Contacts), Settings, Communications, JobItems, Expenses, Labor rates, Equipment rates.

### What changes

| File | Change |
|---|---|
| `src/context/DataProvider.tsx` | **New file.** Fetches all datasets once, provides via context. |
| `src/hooks/useJobs.ts` | Reads from DataProvider context instead of fetching independently. |
| `src/hooks/useClients.ts` | Same — reads from context. |
| `src/hooks/useExpenses.ts` | Same — reads from context. |
| `src/hooks/useJobItems.ts` | Same — reads from context. |
| `src/hooks/useCommunications.ts` | Same — reads from context. |
| `src/hooks/useSettings.ts` | Same — reads from context. |
| `src/hooks/useRates.ts` | Same — reads from context. |
| `src/App.tsx` | Wraps authenticated routes with `DataProvider`. |

The hooks keep their existing API (return the same shape), so **no page components need to change**. `useJobActions.ts` also needs no changes — it calls the same hooks, which now read from the shared context.

### How writes work

Writes are unchanged. Each hook still exposes its mutation functions (`createJob`, `updateJob`, `deleteJob`, etc.) that:

1. Call the Google Sheets API directly (e.g., `appendRow`, `updateRowById`)
2. Optimistically update the shared context state (e.g., `setJobs((prev) => [...prev, newJob])`)

This is the same pattern the hooks use today — the only difference is that the state lives in the DataProvider instead of in each hook instance.

### Why this is safe from data conflicts

- **Writes always go directly to Google Sheets.** There is no write buffer or queue. Every `createJob()`, `updateJob()`, etc. makes an immediate HTTP request to the Sheets API.
- **Optimistic updates keep the UI in sync.** After a successful write, the local state is updated to match what was written. This is the existing behavior.
- **No cross-tab sharing.** Each browser tab has its own React state. Tab A and Tab B are completely independent — they share nothing. (This is also the existing behavior.)
- **Multi-tab conflict risk is unchanged.** If two tabs edit the same row, last write wins. This was already the case before this change.
- **A reload function is available.** Each hook still exposes `reload()` to force a fresh fetch from Google Sheets when needed.

### Rate limit error handling

Even with the DataProvider fix, it's possible for a user to hit the API quota (e.g., rapid manual reloads, or write-heavy workflows). When this happens, the app should fail gracefully instead of silently showing empty data.

**Detection:** Any Google Sheets API response with status `429` triggers rate-limit mode. The `Retry-After` header (if present) or a default of 60 seconds determines the cooldown duration.

**Behavior during rate-limit mode:**

1. A banner appears at the top of the app: *"Google Sheets API limit reached. Retrying in X seconds..."* with a live countdown.
2. All write operations (create, update, delete) are **blocked at the UI level** — buttons are disabled and show a tooltip/message explaining the temporary restriction. This prevents data loss from writes that would silently fail.
3. Read requests are paused (not retried in a loop) until the countdown expires.
4. When the countdown reaches zero, the app automatically retries the failed read operations. The banner dismisses on success.

**Implementation:**

- The rate-limit state (`isRateLimited`, `retryAfterTimestamp`) lives in the DataProvider context so all components can read it.
- A thin wrapper around `fetch` in `sheets.ts` detects 429 responses and sets the rate-limit state instead of throwing. This keeps the detection in one place.
- Mutation functions in each hook check `isRateLimited` before making API calls and throw a user-friendly error if blocked.
- A small `RateLimitBanner` component (rendered in `AppShell`) reads the rate-limit state and displays the countdown.

**What changes (in addition to the DataProvider changes above):**

| File | Change |
|---|---|
| `src/services/google/sheets.ts` | Detect 429 responses, parse `Retry-After`, call a rate-limit callback. |
| `src/context/DataProvider.tsx` | Hold `isRateLimited` / `retryAfter` state, expose via context, auto-retry when cooldown expires. |
| `src/components/layout/RateLimitBanner.tsx` | **New file.** Displays the countdown banner. |
| `src/components/layout/AppShell.tsx` | Renders `RateLimitBanner`. |
| `src/hooks/use*.ts` (all data hooks) | Mutation functions check `isRateLimited` before calling the API. |

### What this does NOT do

- Does NOT add a data cache with a TTL (no risk of serving stale data on a timer)
- Does NOT add local persistence (sessionStorage, localStorage, etc.)
- Does NOT change what data is fetched or how (same `getRows()` and `batchGet()` calls)
- Does NOT change the API surface of any existing hook
- Does NOT add new dependencies
