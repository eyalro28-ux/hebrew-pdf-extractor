import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(request: Request) {
  let pages: string[];
  try {
    const body = await request.json() as { pages: unknown };
    if (!Array.isArray(body.pages) || body.pages.length === 0) {
      return NextResponse.json({ error: 'pages must be a non-empty array' }, { status: 400 });
    }
    pages = body.pages as string[];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const pageTexts: string[] = [];

  for (const pageDataUrl of pages) {
    const base64 = pageDataUrl.replace(/^data:image\/\w+;base64,/, '');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: base64 },
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

  return NextResponse.json({ text: pageTexts.join('\n\n') });
}
