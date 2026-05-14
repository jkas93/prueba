import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAuth } from "next-firebase-auth-edge/lib/auth";

export async function POST(request: NextRequest) {
  // next-firebase-auth-edge middleware will intercept this request,
  // validate the Authorization header, and append the session cookie
  // to the response. We just need to return a 200 OK.
  return NextResponse.json({ success: true });
}
