import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

/** Límites de cuerpo para las APIs: los route handlers no tienen límite por
 * defecto y un usuario autenticado podría mandar un JSON enorme y tumbar el
 * proceso. Los binarios solo se aceptan en /api/ingest (PDF ≤ 25 MB). */
const MAX_JSON = 2 * 1024 * 1024;
const MAX_UPLOAD = 30 * 1024 * 1024;

export function proxy(request: NextRequest) {
  if (
    request.method === "POST" ||
    request.method === "PUT" ||
    request.method === "PATCH" ||
    request.method === "DELETE"
  ) {
    const longitud = Number(request.headers.get("content-length") ?? "0");
    const max = request.nextUrl.pathname === "/api/ingest" ? MAX_UPLOAD : MAX_JSON;
    if (Number.isFinite(longitud) && longitud > max) {
      return NextResponse.json({ error: "Cuerpo demasiado grande" }, { status: 413 });
    }
  }

  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith("/_next");

  const hasSession = Boolean(request.cookies.get("mj_session")?.value);
  if (!isPublic && !hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
