import { describe, it, expect } from 'vitest';
import { buildPageText } from '../extractPdf';

describe('buildPageText', () => {
  it('returns empty string for empty items', () => {
    expect(buildPageText([])).toBe('');
  });

  it('reverses each item str to convert visual→logical order', () => {
    // "ךותב" is "בתוך" (within) stored visually reversed in the PDF
    const items = [{ str: 'ךותב', transform: [1, 0, 0, 1, 100, 700] }];
    expect(buildPageText(items)).toBe('בתוך');
  });

  it('sorts items right-to-left (X descending) then reverses each', () => {
    // Two items on same line: 'לכ' at X=100, 'ךותב' at X=160 (rightmost → first in Hebrew)
    // X desc order: ךותב(160)→בתוך, then לכ(100)→כל
    const items = [
      { str: 'לכ', transform: [1, 0, 0, 1, 100, 700] },
      { str: 'ךותב', transform: [1, 0, 0, 1, 160, 700] },
    ];
    expect(buildPageText(items)).toBe('בתוךכל');
  });

  it('adds newline when Y coordinate changes by more than 2', () => {
    // 'הנושאר הרוש' reversed = 'שורה ראשונה', 'היינש הרוש' reversed = 'שורה שנייה'
    const items = [
      { str: 'הנושאר הרוש', transform: [1, 0, 0, 1, 100, 700] },
      { str: 'היינש הרוש', transform: [1, 0, 0, 1, 100, 685] },
    ];
    expect(buildPageText(items)).toBe('שורה ראשונה\nשורה שנייה');
  });

  it('does not add newline when Y changes by 2 or less', () => {
    // 'א' at X=120 (rightmost→first), 'ב' at X=100; each reversed = same single char
    const delta1 = [
      { str: 'ב', transform: [1, 0, 0, 1, 100, 700] },
      { str: 'א', transform: [1, 0, 0, 1, 120, 701] },
    ];
    expect(buildPageText(delta1)).toBe('אב');

    const delta2 = [
      { str: 'ב', transform: [1, 0, 0, 1, 100, 700] },
      { str: 'א', transform: [1, 0, 0, 1, 120, 698] },
    ];
    expect(buildPageText(delta2)).toBe('אב');
  });

  it('skips non-text items (no str property)', () => {
    // 'ךותב' reversed = 'בתוך'; the non-text item is ignored
    const items = [
      { str: 'ךותב', transform: [1, 0, 0, 1, 100, 700] },
      { type: 'beginMarkedContent', id: 'mc1' },
    ];
    expect(buildPageText(items)).toBe('בתוך');
  });
});
