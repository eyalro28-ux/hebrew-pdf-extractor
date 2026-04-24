type PdfTextItem = { str: string; transform: [number, number, number, number, number, number] };
type PdfItem = PdfTextItem | Record<string, unknown>;

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

  let result = '';
  let lastY: number | null = null;

  for (const item of textItems) {
    const currentY = item.transform[5];
    if (lastY !== null && Math.abs(currentY - lastY) > 2) {
      result += '\n';
    }
    result += item.str;
    lastY = currentY;
  }

  return result;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    pageTexts.push(buildPageText(textContent.items as PdfItem[]));
  }

  return pageTexts.join('\n\n');
}
