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

type PdfPage = {
  getTextContent: () => Promise<{ items: PdfItem[] }>;
};

function isTextItem(item: PdfItem): item is PdfTextItem {
  return (
    'str' in item &&
    typeof (item as PdfTextItem).str === 'string' &&
    Array.isArray((item as PdfTextItem).transform) &&
    (item as PdfTextItem).transform.length >= 6
  );
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
      // Sort right to left (higher X = rightmost on page = first in Hebrew reading order)
      lineItems.sort((a, b) => b.transform[4] - a.transform[4]);
      return lineItems.map(item => item.str).join('');
    })
    .join('\n');
}

const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

let cachedLib: PdfJsLib | null = null;

async function getPdfJs(): Promise<PdfJsLib> {
  if (cachedLib) return cachedLib;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'));
    document.head.appendChild(script);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lib = (window as any).pdfjsLib as PdfJsLib;
  lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
  cachedLib = lib;
  return lib;
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
