import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

import { POST } from '../route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/extract-vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getMockCreate() {
  return mockCreate;
}

beforeEach(() => {
  getMockCreate().mockReset();
});

describe('POST /api/extract-vision', () => {
  it('returns 400 when pages is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when pages is empty', async () => {
    const res = await POST(makeRequest({ pages: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/extract-vision', {
      method: 'POST',
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when pages has more than one element', async () => {
    const res = await POST(makeRequest({
      pages: ['data:image/jpeg;base64,abc1', 'data:image/jpeg;base64,abc2'],
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/one page per request/);
  });

  it('returns 400 when pages contains non-string elements', async () => {
    const res = await POST(makeRequest({ pages: [42] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/strings/);
  });

  it('calls Claude and returns extracted text for a single page', async () => {
    getMockCreate().mockResolvedValueOnce({ content: [{ type: 'text', text: 'שלום עולם' }] });

    const res = await POST(makeRequest({ pages: ['data:image/jpeg;base64,abc1'] }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe('שלום עולם');
    expect(getMockCreate()).toHaveBeenCalledTimes(1);
  });

  it('strips data URL prefix and sets jpeg media_type before sending to Claude', async () => {
    getMockCreate().mockResolvedValueOnce({ content: [{ type: 'text', text: 'טקסט' }] });

    await POST(makeRequest({ pages: ['data:image/jpeg;base64,SGVsbG8='] }));

    const call = getMockCreate().mock.calls[0][0];
    const imageSource = call.messages[0].content[0].source;
    expect(imageSource.data).toBe('SGVsbG8=');
    expect(imageSource.type).toBe('base64');
    expect(imageSource.media_type).toBe('image/jpeg');
  });
});
