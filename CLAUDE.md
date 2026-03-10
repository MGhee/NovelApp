# CLAUDE.md

This file guides **Claude Code (claude.ai/code)** when working in this repository.

Claude should treat this file as the **source of truth for architecture, constraints, and workflows**.

---

# Project Overview

This project is a **web novel tracker with a browser extension**.

The extension detects when the user reads a chapter and **automatically updates reading progress** in the web app.

System components:

1. **Next.js web application**
2. **Browser extension (Manifest v3)**

Communication between them happens through **Next.js API routes**.

---

# Tech Stack

Frontend / App

- Next.js (App Router)
- React
- TypeScript
- Tailwind v4

Backend

- Next.js API routes
- Prisma 7
- SQLite

Extension

- Manifest v3
- content script
- background service worker

---

# Development Commands

Start dev server

```bash
npm run dev
```

Runs at:

```
http://localhost:3000
```

Build production

```bash
npm run build
```

Lint

```bash
npm run lint
```

---

# Prisma Commands

Generate client

```bash
npx prisma generate
```

Create migration

```bash
npx prisma migrate dev
```

Apply migrations

```bash
npx prisma migrate deploy
```

Reset DB

```bash
npx prisma migrate reset
```

Seed DB

```bash
npx prisma db seed
```

Open database viewer

```bash
npx prisma studio
```

---

# Database Architecture

The project uses **Prisma 7 with SQLite**.

Prisma **requires a driver adapter**.

Correct initialization:

```ts
import { PrismaClient } from "src/generated/prisma"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import path from "path"

const adapter = new PrismaBetterSqlite3({
  url: path.resolve(process.cwd(), "dev.db")
})

export const prisma = new PrismaClient({ adapter } as any)
```

Rules:

- Never use `new PrismaClient()` without adapter
- Do not import from `@prisma/client`
- Generated client lives in `src/generated/prisma`

Database file:

```
dev.db
```

located at the project root.

---

# Prisma Seed

Seed configuration lives in:

```
prisma.config.ts
```

Seed script:

```
prisma/seed.ts
```

---

# Styling

Uses **Tailwind v4 with minimal configuration**.

Imported in `globals.css`:

```css
@import "tailwindcss";
```

All components use **CSS variables** from `globals.css`.

Example:

```tsx
style={{
  background: "var(--bg)",
  color: "var(--text)"
}}
```

Example variables

```
--bg
--accent
--status-reading
--status-completed
```

Rules:

- Do NOT introduce UI libraries
- Do NOT add Tailwind config unless required
- Prefer CSS variables

---

# Browser Extension

Extension code lives in:

```
extension/
```

Structure

```
extension/
  background.js
  content.js
  popup.js
  popup.html
  manifest.json
```

---

# Chapter Detection

Chapter numbers are detected using:

```
/chapter[_\-\/]?(\d+)/i
```

Examples

```
chapter-10
chapter_10
chapter/10
```

---

# URL Normalization

Chapter URLs must be converted to a **base book URL**.

Example

```
/book-slug/chapter-1.html
```

becomes

```
/book-slug.html
```

Logic is in:

```
src/lib/utils.ts
```

Function:

```
extractBookUrl()
```

Rule:

Database must store **book index URLs only**, never chapter URLs.

---

# Extension → Server Flow

When a chapter page loads:

`content.js` extracts

```
siteUrl
chapterNumber
chapterUrl
```

Then calls

```
POST /api/extension/update
```

Payload

```json
{
  "siteUrl": "...",
  "chapterNumber": 10,
  "chapterUrl": "..."
}
```

---

# Progress Rules

Progress **must only increase**.

```
if newChapter > currentChapter
    update
else
    ignore
```

Also auto-promotes status:

```
PLAN_TO_READ → READING
```

---

# Extension Badge

Controlled in:

```
extension/background.js
```

Badges

```
✓ tracked
· not tracked
! error
```

---

# Scraping

Scraper entry point

```
src/lib/scraper/index.ts
```

Dispatches scraper by hostname.

Example

```
readnovelfull.com → readnovelfull.ts
```

---

## readnovelfull scraper

Scrapes

- title
- author
- cover
- genres

Then fetches chapters from

```
/ajax/chapter-archive?novelId=XXXX
```

`novelId` extracted from

```
#rating[data-novel-id]
```

---

## Generic scraper

Fallback scraper:

```
generic.ts
```

Uses

- OpenGraph metadata
- `a[href*="chapter"]` links

---

# API Routes

All routes live in

```
src/app/api
```

Books

```
GET /api/books
POST /api/books
```

Filters

```
?status=
?search=
?favorites=true
```

Single book

```
GET /api/books/[id]
PATCH /api/books/[id]
DELETE /api/books/[id]
```

PATCH replaces `customFields`.

Characters

```
POST /api/books/[id]/characters
DELETE /api/books/[id]/characters
```

Scraping

```
POST /api/scrape
```

Extension

```
POST /api/extension/update
GET /api/extension/match?url=
```

---

# CORS

API routes allow cross-origin requests.

Configured in:

```
next.config.ts
```

Header:

```
Access-Control-Allow-Origin: *
```

Required for:

```
chrome-extension://
```

---

# Add Book Flow

When extension popup clicks **Add this book** it opens:

```
http://localhost:3000/?add=ENCODED_URL
```

`src/app/page.tsx` reads the parameter using:

```
useSearchParams()
```

inside

```
<Suspense>
```

Then opens:

```
AddBookModal
```

with the URL pre-filled.

---

# Git Workflow

Never commit directly to `main`.

Branch structure:

```
main
feature/*
fix/*
refactor/*
chore/*
```

Examples

```
feature/book-scraper
fix/chapter-regex
refactor/prisma-init
```

---

# Commit Messages

Use **Conventional Commits**

Format

```
type(scope): description
```

Examples

```
feat(extension): detect chapter URLs
fix(api): prevent progress regression
refactor(scraper): simplify dispatch
chore(deps): update prisma
```

---

# Pull Requests

PRs should

- be small
- change one concern
- include explanation
- include testing steps

Example

```
feat(extension): add detection for wuxiaworld
```

---

# Safe Refactoring Rules

Claude may refactor if:

- behavior stays identical
- extension APIs remain compatible
- database schema is unchanged

Claude must ask before:

- changing schema
- modifying progress logic
- altering scraping logic
- changing chapter detection regex

---

# Critical Invariants

These must never be broken.

Book URLs

```
Only store book index URL
Never store chapter URLs
```

Progress

```
Progress can only increase
```

Prisma

```
Must use driver adapter
```

Extension API

```
Must remain backwards compatible
```

---

# Goal

Build a **reliable automatic reading tracker** that works seamlessly with the browser extension.

Priorities:

- reliability
- simplicity
- maintainability
- extension compatibility