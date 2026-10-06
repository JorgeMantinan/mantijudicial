import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

/** Límites de cuerpo para las APIs: los route handlers no tienen límite por
 * defecto y un usuario autenticado podría mandar un JSON enorme y tumbar el
 * proceso. Los binarios solo se aceptan en /api/ingest (PDF ≤ 25 MB). */
const MAX_JSON = 2 * 1024 * 1024;
const MAX_UPLOAD = 30 * 1024 * 1024;

/** CSP con nonce por petición: sin 'unsafe-inline' en scripts (Next aplica el
 * nonce a sus propios <script> cuando lo ve en la cabecera de la petición;
 * los chunks están en 'self'). La hoja de estilos sigue con 'unsafe-inline'
 * porque React inyecta atributos style. */
function cabeceraCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = cabeceraCsp(nonce);
  const salir = (response: NextResponse): NextResponse => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  if (
    request.method === "POST" ||
    request.method === "PUT" ||
    request.method === "PATCH" ||
    request.method === "DELETE"
  ) {
    const longitud = Number(request.headers.get("content-length") ?? "0");
    const max = request.nextUrl.pathname === "/api/ingest" ? MAX_UPLOAD : MAX_JSON;
    if (Number.isFinite(longitud) && longitud > max) {
      return salir(NextResponse.json({ error: "Cuerpo demasiado grande" }, { status: 413 }));
    }
  }

  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith("/_next");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const hasSession = Boolean(request.cookies.get("mj_session")?.value);
  if (!isPublic && !hasSession) {
    if (pathname.startsWith("/api/")) {
      return salir(NextResponse.json({ error: "No autenticado" }, { status: 401 }));
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return salir(NextResponse.redirect(url));
  }
  return salir(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
