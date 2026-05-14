import { NextResponse } from 'next/server';

// next-firebase-auth-edge intercepta /api/logout, 
// pero dejamos esta ruta por si algún componente antiguo la llama.
export async function POST() {
  return NextResponse.redirect(new URL('/login', 'http://localhost:3000'));
}
