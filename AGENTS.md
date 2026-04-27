# Hebrew PDF Extractor — CLAUDE.md

## What this is
Personal tool for extracting Hebrew text from PDFs. Most tools mangle RTL Hebrew because of broken ToUnicode CMap font encodings in many Hebrew PDFs. This tool handles it correctly and delivers copy-ready output.

Deployed at Vercel. Repo: github.com/eyalro28-ux/hebrew-pdf-extractor

## Stack
- Next.js 16 (App Router), TypeScript, Tailwind v4
- PDF.js loaded from CDN at runtime (not bundled) — avoids canvas/worker build issues
- Anthropic SDK (`@anthropic-ai/sdk`) for Vision fallback
- Vitest + jsdom for tests

## Run locally
```bash
npm run dev        # http://localhost:3000
npm test           # run all tests
npm run build      # production build check
```

## Env vars
`ANTHROPIC_API_KEY` — required for Vision fallback. Set in `.env.local` locally, in Vercel environment settings for production.

## Architecture

### Primary path (PDF.js text extraction)
`lib/extractPdf.ts` — client-side, no server involved:
1. Load PDF.js from CDN
2. Extract text items per page via `getTextContent()`
3. Group by Y coordinate (line detection), sort X descending (RTL order), reverse each item's characters (visual→logical Unicode)
4. Run `isLikelyGarbledHebrew()` on result — if garbled, fall through to Vision

### Vision fallback path
Triggered automatically when PDF.js text is empty or garbled. Also manually via "Text looks wrong? Try AI" button.
1. `renderPdfPagesToImages()` renders each page to a JPEG canvas at 1.5x scale
2. Pages sent one at a time (not batched) to avoid Vercel's 4.5MB body limit
3. `POST /api/extract-vision` (`app/api/extract-vision/route.ts`) calls `claude-sonnet-4-6` Vision
4. Results joined and displayed

**Why Sonnet not Haiku:** Haiku hallucinated uncommon Hebrew words in testing (e.g. יזומה→יומית). Sonnet is accurate.

### Garbled Hebrew detection (`isLikelyGarbledHebrew`)
Hebrew final-form letters (ם,ן,ך,ף,ץ) never appear at the START of a valid Hebrew word. If any word starts with one, the font encoding is broken. Zero false positives on valid Hebrew.

## Key files
- `lib/extractPdf.ts` — all PDF extraction logic + garbled detection
- `app/page.tsx` — UI, file handling, orchestration (primary → Vision fallback)
- `app/api/extract-vision/route.ts` — server route calling Anthropic Vision API
- `vercel.json` — sets `maxDuration: 60` for the Vision route

## Vercel deployment
Push to `main` → auto-deploys. Hobby plan supports up to 60s function timeout (configured in `vercel.json`). Pages are sent one at a time to stay under the 4.5MB body limit.

## Tests
- `lib/__tests__/extractPdf.test.ts` — unit tests for `buildPageText` and `isLikelyGarbledHebrew`
- `app/api/extract-vision/__tests__/route.test.ts` — mocked Anthropic SDK, tests input validation and response shape
