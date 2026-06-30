import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export const maxDuration = 60;

// Cap the decoded image at 8MB. The client renders pages to JPEG one at a time,
// so a legitimate page is well under this; the limit exists to stop a direct POST
// from forwarding an arbitrarily large payload straight to the paid Vision API.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// The client renders pages to JPEG and the Vision call below sends image/jpeg,
// so only JPEG data URLs are accepted here.
const DATA_URL_PREFIX = /^data:image\/jpeg;base64,/;

export async function POST(request: Request) {
  let pageDataUrl: string;
  try {
    const body = await request.json() as { pages: unknown };
    if (!Array.isArray(body.pages) || body.pages.length === 0) {
      return NextResponse.json({ error: 'pages must be a non-empty array' }, { status: 400 });
    }
    if (body.pages.length > 1) {
      return NextResponse.json({ error: 'send one page per request' }, { status: 400 });
    }
    if (!body.pages.every((p: unknown) => typeof p === 'string')) {
      return NextResponse.json({ error: 'pages must be an array of strings' }, { status: 400 });
    }
    pageDataUrl = body.pages[0] as string;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Reject anything that isn't an image data URL before it reaches the model.
  if (!DATA_URL_PREFIX.test(pageDataUrl)) {
    return NextResponse.json({ error: 'pages must be image data URLs' }, { status: 400 });
  }

  const base64 = pageDataUrl.replace(/^data:image\/[^;]+;base64,/, '');

  // base64 decodes to ~3/4 of its length in bytes.
  const approxBytes = Math.floor(base64.length * 0.75);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'page image too large' }, { status: 413 });
  }

  // Stream the response so Vercel sees data flowing immediately (~1-3s) instead
  // of waiting for the full completion — avoids 504 within the 60s function timeout.
  const anthropicStream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
          },
          {
            type: 'text',
            text: 'Extract all Hebrew text from this document page. Return only the extracted text, preserving line breaks and paragraph structure. Do not add commentary, headers, or explanations.',
          },
        ],
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of anthropicStream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
