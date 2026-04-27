# Hebrew PDF Extractor

Personal tool for extracting Hebrew text from PDFs with broken CMap font encodings. Most tools mangle RTL Hebrew — this one gets it right.

## Run locally

```bash
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
npm test                     # run tests
```

## How it works

1. Tries PDF.js text extraction first (fast, no API cost)
2. Auto-detects garbled Hebrew (broken font encoding) via final-form letter heuristic
3. Falls back to Claude Vision (`claude-sonnet-4-6`) — renders pages as JPEG, streams extraction results

See `AGENTS.md` for full architecture details.
