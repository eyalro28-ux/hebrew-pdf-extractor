import { describe, it, expect } from 'vitest';
import { buildPageText } from '../extractPdf';

describe('buildPageText', () => {
  it('returns empty string for empty items', () => {
    expect(buildPageText([])).toBe('');
  });

  it('joins text items on the same line (same Y)', () => {
    const items = [
      { str: 'שלום ', transform: [1, 0, 0, 1, 100, 700] },
      { str: 'עולם', transform: [1, 0, 0, 1, 160, 700] },
    ];
    expect(buildPageText(items)).toBe('שלום עולם');
  });

  it('adds newline when Y coordinate changes by more than 2', () => {
    const items = [
      { str: 'שורה ראשונה', transform: [1, 0, 0, 1, 100, 700] },
      { str: 'שורה שנייה', transform: [1, 0, 0, 1, 100, 685] },
    ];
    expect(buildPageText(items)).toBe('שורה ראשונה\nשורה שנייה');
  });

  it('does not add newline when Y changes by 2 or less', () => {
    const delta1 = [
      { str: 'א', transform: [1, 0, 0, 1, 100, 700] },
      { str: 'ב', transform: [1, 0, 0, 1, 120, 701] },
    ];
    expect(buildPageText(delta1)).toBe('אב');

    const delta2 = [
      { str: 'א', transform: [1, 0, 0, 1, 100, 700] },
      { str: 'ב', transform: [1, 0, 0, 1, 120, 698] },
    ];
    expect(buildPageText(delta2)).toBe('אב');
  });

  it('skips non-text items (no str property)', () => {
    const items = [
      { str: 'טקסט', transform: [1, 0, 0, 1, 100, 700] },
      { type: 'beginMarkedContent', id: 'mc1' },
    ];
    expect(buildPageText(items)).toBe('טקסט');
  });
});
