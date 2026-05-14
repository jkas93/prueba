import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "next-firebase-auth-edge";

const commonOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  cookieName: "AuthToken",
  cookieSignatureKeys: ["secret-key-for-signing-cookies"], // Should be in env
  cookieSerializeOptions: {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Set this to true on HTTPS environments
    sameSite: "lax" as const,
    maxAge: 12 * 60 * 60 * 24, // twelve days
  },
  serviceAccount: {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
    // Replace \n with actual newlines if coming from env
    privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  },
};

export async function middleware(request: NextRequest) {
  return authMiddleware(request, {
    loginPath: "/api/login",
    logoutPath: "/api/logout",
    ...commonOptions,
    handleValidToken: async (_tokens, headers) => {
      // User is authenticated
      if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      return NextResponse.next({
        request: {
          headers
        }
      });
    },
    handleInvalidToken: async () => {
      // User is not authenticated
      const isPublicRoute =
        request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/register') ||
        request.nextUrl.pathname.startsWith('/auth') ||
        request.nextUrl.pathname.startsWith('/share') ||
        request.nextUrl.pathname.startsWith('/print') ||
        request.nextUrl.pathname === '/api/' ||
        request.nextUrl.pathname === '/';

      if (!isPublicRoute) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return NextResponse.next();
    },
    handleError: async (error) => {
      console.error("Auth Edge Middleware Error:", error);
      return NextResponse.next();
    }
  });
}

export const config = {
  matcher: [
    "/",
    "/api/login",
    "/api/logout",
    "/((?!_next|favicon.ico).*)"
  ],
};
