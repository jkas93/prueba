import { NextRequest, NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/login', request.nextUrl.origin));
}
