import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export const maxDuration = 60;

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

  const base64 = pageDataUrl.replace(/^data:image\/[^;]+;base64,/, '');

  // Stream the response so Vercel sees data flowing immediately (~1-3s) instead
  // of waiting for the full completion — avoids 504 on Hobby plan's 10s timeout.
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
