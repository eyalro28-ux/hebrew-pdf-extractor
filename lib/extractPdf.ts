type PdfTextItem = { str: string; transform: [number, number, number, number, number, number] };
type PdfItem = PdfTextItem | Record<string, unknown>;

type PdfJsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (source: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
};

type PdfDocument = {
  numPages: number;
  getPage: (num: number) => Promise<PdfPage>;
};

type PdfViewport = { width: number; height: number };

type PdfPage = {
  getTextContent: () => Promise<{ items: PdfItem[] }>;
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => { promise: Promise<void> };
};

function isTextItem(item: PdfItem): item is PdfTextItem {
  return (
    'str' in item &&
    typeof (item as PdfTextItem).str === 'string' &&
    Array.isArray((item as PdfTextItem).transform) &&
    (item as PdfTextItem).transform.length >= 6
  );
}

// PDF stores Hebrew in visual left-to-right order; reverse chars to get logical Unicode order.
function toLogicalOrder(str: string): string {
  return str.split('').reverse().join('');
}

export function buildPageText(items: PdfItem[]): string {
  const textItems = items.filter(isTextItem);
  if (textItems.length === 0) return '';

  // Group items by Y coordinate (within 2-unit tolerance)
  const lineMap = new Map<number, PdfTextItem[]>();
  for (const item of textItems) {
    const y = item.transform[5];
    let matchedY: number | undefined;
    for (const existingY of lineMap.keys()) {
      if (Math.abs(existingY - y) <= 2) {
        matchedY = existingY;
        break;
      }
    }
    if (matchedY === undefined) {
      lineMap.set(y, [item]);
    } else {
      lineMap.get(matchedY)!.push(item);
    }
  }

  // Sort lines top to bottom (PDF Y increases upward → higher Y = top of page)
  const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

  return sortedYs
    .map(y => {
      const lineItems = lineMap.get(y)!;
      // Items are in visual left-to-right page order; sort right-to-left for Hebrew reading order
      lineItems.sort((a, b) => b.transform[4] - a.transform[4]);
      return lineItems.map(item => toLogicalOrder(item.str)).join('');
    })
    .join('\n');
}

// Final-form Hebrew letters (ם,ן,ך,ף,ץ) never appear at the start of a valid Hebrew word.
// If any word starts with one, the font encoding is broken and text extraction is garbled.
const HEBREW_FINAL_FORMS = new Set(['ם', 'ן', 'ך', 'ף', 'ץ']);

export function isLikelyGarbledHebrew(text: string): boolean {
  return text.split(/\s+/).some(word => word.length > 0 && HEBREW_FINAL_FORMS.has(word[0]));
}

// Pinned for security: 3.11.174 was vulnerable to CVE-2024-4367 (arbitrary JS
// execution via a crafted PDF font). Fixed in >= 4.2.67; we pin the latest 4.x.
const PDFJS_VERSION = '4.10.38';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

// PDF.js 4.x ships as an ES module only (no UMD/global build on cdnjs), so it is
// loaded via a dynamic import() rather than a <script> tag reading window.pdfjsLib.
// SRI note: Subresource Integrity (the `integrity` attribute) only applies to
// <script>/<link> tags. A dynamic ESM import() cannot carry an integrity hash,
// and the worker is consumed as a URL string, so SRI is not applicable here.
// The exact sha384 hashes of the pinned files (for auditing / a future proxy or
// import-map-with-integrity setup) are:
//   pdf.min.mjs         sha384-+0ti2moQlmLN7WZHE2RHIf5lV8hHxhxEalN0il3YZceG26fUPyOkR0hp9daxk1i7
//   pdf.worker.min.mjs  sha384-ToeVvShCxKc6CEvhHeMt0Q8A06pSPDbAlngO9nokrDmh914gk/pYd0N7D0a4Lz2o
const PDFJS_MODULE_URL = `${PDFJS_CDN}/pdf.min.mjs`;
const PDFJS_WORKER_URL = `${PDFJS_CDN}/pdf.worker.min.mjs`;

let loadPromise: Promise<PdfJsLib> | null = null;

async function getPdfJs(): Promise<PdfJsLib> {
  if (!loadPromise) {
    loadPromise = (async () => {
      // webpackIgnore/turbopackIgnore keep the bundler from trying to resolve the
      // remote URL at build time — it must be fetched from the CDN at runtime.
      const mod = (await import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */ PDFJS_MODULE_URL
      )) as unknown as PdfJsLib;
      if (!mod || typeof mod.getDocument !== 'function') {
        throw new Error('Failed to load PDF.js from CDN');
      }
      mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return mod;
    })();
  }
  return loadPromise;
}

export async function renderPdfPagesToImages(file: File): Promise<string[]> {
  const lib = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: arrayBuffer }).promise;

  const images: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.85));
  }

  return images;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const lib = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    pageTexts.push(buildPageText(textContent.items));
  }

  return pageTexts.join('\n\n');
}
