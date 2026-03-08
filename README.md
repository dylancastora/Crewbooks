# Crewbooks

A lightweight operations manager for film industry freelancers. Track clients, jobs, expenses, rates, quotes, and invoices — all stored in your own Google Workspace.

No subscription, no backend, no database to manage. Your data lives in Google Sheets, Drive, and Gmail.

Free hosted version at Crewbooks.io

---

## Features

- **Jobs** — Create and track jobs through a full lifecycle: Draft → Quoted → Approved → Invoiced → Paid
- **Line items** — Add labor, equipment, mileage, and reimbursable expenses
- **Expenses** — Log expenses per job with receipt photo uploads, linked to invoices
- **Clients & contacts** — Manage client companies and individual contacts for quote/invoice delivery
- **Rates** — Save reusable labor and equipment rate templates
- **Quotes & invoices** — Generate HTML email quotes and PDF invoices, sent via Gmail with receipts attached
- **Dashboard** — See earnings, receivables, and pipeline at a glance
- **Settings** — Configure your business name, address, mileage rate, payment terms, and invoice numbering
- **PWA** — Install as a standalone app on desktop or mobile

---

## How It Works

Crewbooks runs entirely in the browser. After signing in with Google, it creates a spreadsheet ("CrewBooks Database") and a folder ("CrewBooks") in your Google Drive. All data is read from and written to that spreadsheet. Receipt photos are stored in your Drive. Quotes and invoices are sent from your Gmail.

No data ever touches a third-party server.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Database | Google Sheets API v4 |
| File storage | Google Drive API v3 |
| Email delivery | Gmail API v1 |
| Auth | Google OAuth 2.0 |
| PDF generation | jsPDF |
| PWA | vite-plugin-pwa |

---

## To Do

Features:
- Save Invoice PDFs in Google Drive, with a unique reference to the communication that generated it
- Due date system
- Keep me signed in
- Google calendar integration
- Data import/migration
- Confirm unsaved changes before navigating away
- Reject user after auth if all data scopes not agreed to

UI Improvements:
- Consistent button sizes
- Modify [+ New Gear rate] and [+ New Labor rate] buttons so they're easily distinguishable from the [+ line item] buttons.

Known Bugs:
- Intermittent logout/data desync

---

## In Progress

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Google account
- A Google Cloud project with the following APIs enabled:
  - Google Sheets API
  - Google Drive API
  - Gmail API

### 1. Clone and install

```bash
git clone https://github.com/your-username/crewbooks.git
cd crewbooks
npm install
```

### 2. Configure Google OAuth

In your [Google Cloud Console](https://console.cloud.google.com):

1. Create (or select) a project
2. Enable the Sheets, Drive, and Gmail APIs
3. Create an **OAuth 2.0 Client ID** (Web application type)
4. Add your development origin to **Authorized JavaScript origins** (e.g. `http://localhost:5173`)
5. Add your production domain as well when deploying

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_SUPPORT_EMAIL=your-email@example.com
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in with Google. On first login, Crewbooks will automatically create the spreadsheet and Drive folder in your account.

---

## Development

```bash
npm run dev       # Start dev server
npm run build     # Type-check and build for production
npm run preview   # Preview production build locally
npm run lint      # Run ESLint
```

---

## Deployment

Build the app and serve the `dist/` folder from any static host (Vercel, Netlify, GitHub Pages, etc.).

```bash
npm run build
```

Make sure to add your production domain to the **Authorized JavaScript origins** in your Google Cloud OAuth client settings.

---

## Project Structure

```
src/
├── pages/          # Route-level components (Dashboard, Jobs, Clients, etc.)
├── components/     # Reusable UI and feature components
├── services/
│   ├── google/     # Sheets, Drive, Gmail, and Auth API wrappers
│   └── api/        # Business logic (jobs, clients, expenses, etc.)
├── hooks/          # Data-fetching and action hooks
├── context/        # Auth context
├── templates/      # HTML email and PDF invoice generators
├── types/          # TypeScript interfaces
└── utils/          # Date formatting, sanitization
```

---

## Data Model

All data is stored in tabs within a single Google Sheets spreadsheet:

| Sheet tab | Contents |
|---|---|
| Jobs | Job headers, status, shoot dates, job numbers |
| JobItems | Line items (labor, equipment, mileage, custom) |
| Clients | Company name, address, contact info |
| Contacts | Individual contacts linked to clients |
| Labor | Reusable labor rate templates |
| Equipment | Reusable equipment rate templates |
| Expenses | Expenses linked to jobs, with Drive file IDs for receipts |
| Communications | History of quotes and invoices sent |
| Settings | Key-value store for business settings |

---

## Privacy

Crewbooks requests the following Google OAuth scopes:

- `userinfo.profile` / `userinfo.email` — display your name and email
- `spreadsheets` — read/write your CrewBooks spreadsheet
- `drive.file` — upload receipt photos (only files created by this app)
- `gmail.send` — send quotes and invoices from your Gmail account

Access tokens are stored in memory only and are never sent to any external server.

---

## Contributing

Pull requests are welcome. For significant changes, please open an issue first to discuss what you'd like to change.

---

## License

AGPL-3.0

Crewbooks is free and open source. The hosted version at Crewbooks.io is currently free to use. Voluntary contributions help sustain development — if the project grows, a nominal hosting fee may be introduced in the future. Self-hosting will always be free.

