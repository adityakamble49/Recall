<p align="center">
  <img src="assets/recall-github.png" alt="Recall" width="600" />
</p>

# Recall

**Precision bookmark organization. Your digital library, evolved into a high-performance utility.**

Recall is a minimalistic bookmark tracker with a web app and Chrome extension. Save, categorize, and open bookmarks as Chrome tab groups — all with surgical precision.

🌐 [Live App](https://recall-ebon.vercel.app) · [Issues](https://github.com/adityakamble49/Recall/issues)

---

## Overview

Recall solves the problem of scattered bookmarks across browsers and devices. Instead of a flat list, bookmarks are organized into **collections** that can be opened as **Chrome tab groups** with one click.

### Key Features

- **Collections** — Organize bookmarks into named, colored collections
- **Chrome Tab Groups** — Open all bookmarks in a collection as a Chrome tab group instantly
- **Chrome Extension** — Save the current tab to any collection with one click
- **Instant Capture** — Quick URL paste on the dashboard for rapid bookmarking
- **Responsive Design** — Desktop sidebar layout + mobile-first with floating bottom nav
- **Zenith Flat Design System** — Clean, clinical UI with tonal surface layering (no borders, no heavy shadows)

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Actions) |
| UI | React 19, Tailwind CSS v4, Plus Jakarta Sans |
| Database | Neon PostgreSQL (serverless) |
| ORM | Drizzle ORM |
| Auth | NextAuth v5 (Google OAuth) |
| Hosting | Vercel |
| Extension | Chrome Manifest V3 |

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **npm** 9+
- A **Neon** PostgreSQL database ([neon.tech](https://neon.tech))
- **Google OAuth** credentials ([console.cloud.google.com](https://console.cloud.google.com/apis/credentials))

### 1. Clone & Install

```bash
git clone https://github.com/adityakamble49/Recall.git
cd Recall
npm install
```

### 2. Environment Setup

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=your_auth_secret_here
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
```

Generate `AUTH_SECRET`:

```bash
openssl rand -base64 33
```

### 3. Database Setup

Push the schema to your Neon database:

```bash
npx drizzle-kit push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Chrome Extension

The Chrome extension lets you save the current tab to any collection and open collections as tab groups.

### Install (Developer Mode)

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repo

### Connect to Your Account

1. Go to **Settings** in the Recall web app
2. Click **Generate Extension Token**
3. Copy the token
4. Click the Recall extension icon → paste the token → **Connect**

### Dev / Prod Toggle

The extension has a built-in environment switcher:

- Click the ⚙️ gear icon in the extension header
- Toggle between **DEV** (`localhost:3000`) and **PROD** (Vercel URL)
- Each environment can have its own token

---

## Project Structure

```
├── app/
│   ├── page.tsx                 # Dashboard (home)
│   ├── layout.tsx               # Root layout with TopBar, Sidebar, BottomNav
│   ├── actions.ts               # Server actions (CRUD for collections & bookmarks)
│   ├── add/page.tsx             # Add bookmark page/modal
│   ├── collections/
│   │   ├── page.tsx             # All collections grid
│   │   └── [id]/page.tsx        # Collection detail with bookmark list
│   ├── settings/page.tsx        # Account, extension token, preferences
│   └── api/
│       ├── auth/[...nextauth]/  # NextAuth route handler
│       ├── bookmarks/route.ts   # GET/POST bookmarks (supports bearer token)
│       ├── collections/route.ts # GET collections (supports bearer token)
│       └── token/route.ts       # GET/POST extension API tokens
├── components/
│   ├── TopBar.tsx               # Glassmorphic header (desktop nav + mobile search)
│   ├── Sidebar.tsx              # Desktop sidebar with Library nav
│   ├── BottomNav.tsx            # Mobile floating bottom nav
│   ├── BookmarkCard.tsx         # List (mobile) + card (desktop) variants
│   ├── CollectionCard.tsx       # Bento grid variants (featured/medium/small)
│   ├── AddBookmarkForm.tsx      # Bookmark + collection creation form
│   ├── InstantCapture.tsx       # Quick URL paste widget
│   ├── OpenTabGroupButton.tsx   # Opens all URLs in new tabs
│   ├── ExtensionToken.tsx       # Token generate/copy/regenerate widget
│   └── SignInPrompt.tsx         # Unauthenticated state
├── lib/
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema (auth + collections + bookmarks + api_tokens)
│   │   └── index.ts             # Neon DB connection
│   ├── api-auth.ts              # Auth helper (session cookie OR bearer token)
│   └── utils.ts                 # formatDistanceToNow helper
├── extension/
│   ├── manifest.json            # Chrome Manifest V3
│   ├── popup.html               # Extension popup UI
│   ├── popup.js                 # Popup logic (token auth, save, tab groups, dev/prod toggle)
│   └── background.js            # Service worker for chrome.tabs.group() API
├── middleware.ts                 # CORS headers for /api/* routes
├── drizzle.config.ts            # Drizzle Kit config
└── .env.example                 # Environment variable template
```

---

## Database Schema

```
user              # NextAuth users (Google OAuth)
account           # OAuth provider accounts
session           # Active sessions
verificationToken # Email verification tokens
collections       # Bookmark collections (name, description, icon, color, isPinned)
bookmarks         # Bookmarks (title, url, favicon, collectionId, isFavorite, isArchived)
api_tokens        # Extension API tokens (bearer auth)
```

To update the schema after changes:

```bash
# Dev
npx drizzle-kit push

# Prod (with prod DATABASE_URL)
DATABASE_URL="your_prod_url" npx drizzle-kit push
```

---

## Deployment

### Vercel

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add environment variables: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
4. Deploy

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `AUTH_SECRET` | NextAuth session encryption secret |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |

---

## Design System

Recall uses the **Zenith Flat** design system — a "flat-plus" philosophy inspired by precision instruments.

- **Font**: Plus Jakarta Sans
- **Primary**: `#4343d5` (Electric Indigo)
- **Surface hierarchy**: Tonal steps instead of shadows (`surface-container-low` → `highest`)
- **No borders for sectioning** — background shifts only
- **Glassmorphism** for floating nav bars (80% opacity + backdrop blur)
- **Icons**: Material Symbols Outlined

See [`design/stitch_add_bookmark/zenith_flat/DESIGN.md`](design/stitch_add_bookmark/zenith_flat/DESIGN.md) for the full specification.

---

## License

MIT
