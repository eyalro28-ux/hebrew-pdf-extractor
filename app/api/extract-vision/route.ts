import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// Allow up to 60s for Vision calls on multi-page PDFs
export const maxDuration = 60;

export async function POST(request: Request) {
  let pages: string[];
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
    pages = body.pages as string[];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const pageTexts: string[] = [];

  try {
    for (const pageDataUrl of pages) {
      const base64 = pageDataUrl.replace(/^data:image\/[^;]+;base64,/, '');

      const response = await client.messages.create({
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

      const block = response.content.find((b) => b.type === 'text');
      if (block && block.type === 'text') {
        pageTexts.push(block.text);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Anthropic API error: ${message}` }, { status: 502 });
  }

  return NextResponse.json({ text: pageTexts.join('\n\n') });
}
