import { NextRequest, NextResponse } from "next/server";
import { authMiddleware } from "next-firebase-auth-edge";

// La clave de firma de cookies — debe estar en variable de entorno
const cookieSignatureKeys = process.env.COOKIE_SIGNATURE_KEYS
  ? process.env.COOKIE_SIGNATURE_KEYS.split(',').map(k => k.trim())
  : ["cronograma-secret-key-2026"]; // fallback seguro para development

const commonOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  cookieName: "AuthToken",
  cookieSignatureKeys,
  cookieSerializeOptions: {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 12 * 60 * 60 * 24, // 12 días
  },
  serviceAccount: {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
    privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  },
};

export async function middleware(request: NextRequest) {
  return authMiddleware(request, {
    loginPath: "/api/login",
    logoutPath: "/api/logout",
    ...commonOptions,
    handleValidToken: async (_tokens, headers) => {
      // Usuario autenticado — redirigir si intenta ir a login/register
      if (
        request.nextUrl.pathname === '/login' ||
        request.nextUrl.pathname === '/register' ||
        request.nextUrl.pathname === '/forgot-password'
      ) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      return NextResponse.next({ request: { headers } });
    },
    handleInvalidToken: async () => {
      // Usuario no autenticado — solo permitir rutas públicas
      const isPublicRoute =
        request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/register') ||
        request.nextUrl.pathname.startsWith('/forgot-password') ||
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
