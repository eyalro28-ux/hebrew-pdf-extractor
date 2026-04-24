import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Vision extraction not yet implemented' },
    { status: 501 }
  );
}
