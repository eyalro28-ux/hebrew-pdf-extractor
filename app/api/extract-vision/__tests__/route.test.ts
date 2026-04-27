import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockStream } = vi.hoisted(() => ({ mockStream: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { stream: mockStream };
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

async function readText(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

function makeAsyncIterable(chunks: object[]): AsyncIterable<object> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) yield chunk;
    },
  };
}

beforeEach(() => {
  mockStream.mockReset();
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

  it('streams extracted text for a single page', async () => {
    mockStream.mockReturnValueOnce(makeAsyncIterable([
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'שלום ' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'עולם' } },
      { type: 'message_stop' },
    ]));

    const res = await POST(makeRequest({ pages: ['data:image/jpeg;base64,abc1'] }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/plain/);
    const text = await readText(res);
    expect(text).toBe('שלום עולם');
  });

  it('strips data URL prefix and sets jpeg media_type before sending to Claude', async () => {
    mockStream.mockReturnValueOnce(makeAsyncIterable([
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'טקסט' } },
    ]));

    await POST(makeRequest({ pages: ['data:image/jpeg;base64,SGVsbG8='] }));

    const call = mockStream.mock.calls[0][0];
    const imageSource = call.messages[0].content[0].source;
    expect(imageSource.data).toBe('SGVsbG8=');
    expect(imageSource.type).toBe('base64');
    expect(imageSource.media_type).toBe('image/jpeg');
  });

  it('ignores non-text-delta chunks in the stream', async () => {
    mockStream.mockReturnValueOnce(makeAsyncIterable([
      { type: 'message_start', message: {} },
      { type: 'content_block_start', index: 0 },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'טקסט' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
      { type: 'message_stop' },
    ]));

    const res = await POST(makeRequest({ pages: ['data:image/jpeg;base64,abc'] }));
    const text = await readText(res);
    expect(text).toBe('טקסט');
  });
});
