# NovelApp

A local reading tracker for web novels, light novels, manga, and manhwa. Tracks your reading progress, scrapes book metadata from reading sites, and auto-updates your chapter progress via a browser extension.

## Requirements

- [Node.js](https://nodejs.org/) v18 or later
- Chrome or Opera browser (for the extension)

## First-Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Generate the Prisma client
npx prisma generate

# 3. Create the database and run migrations
npx prisma migrate deploy

# 4. Seed the database with pre-loaded books
npx prisma db seed
```

## Running the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Installing the Browser Extension

1. Open Chrome/Opera and go to `chrome://extensions`
2. Enable **Developer Mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder inside this project
5. The NovelApp Tracker icon will appear in your toolbar

Once installed, navigate to any chapter on a supported reading site — the extension will automatically update your progress in the app.

**Supported sites:**
- readnovelfull.com
- novelfull.com
- novelbin.com
- lightnovelworld.com

## Adding a New Book

**Via the app:** Click **+ Add Book** on the home page, paste a book URL, and the app will scrape the title, cover, author, and chapter list automatically. Manual entry (no URL) is also supported.

**Via the extension:** On any supported site, click the extension icon. If the book isn't tracked yet, click **+ Add this book** — it will open the app with the URL pre-filled.

## Database

The SQLite database is stored at `dev.db` in the project root. It is created automatically on first migration.

To reset the database and re-seed:

```bash
npx prisma migrate reset
```

This will drop all data, re-run migrations, and re-seed the pre-loaded books.

## Project Structure

```
src/
  app/              Next.js pages and API routes
  components/       UI components (BookCard, AddBookModal, BookDetail, etc.)
  hooks/            useBooks data-fetching hook
  lib/              Prisma client, types, scraper
extension/          Chrome/Opera MV3 browser extension
prisma/             Database schema, migrations, seed data
```
