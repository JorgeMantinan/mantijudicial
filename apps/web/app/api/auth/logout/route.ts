import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, identityPath, loadIdentity } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const identity = await loadIdentity();
    identity.revokeSession(token);
    await identity.save(identityPath());
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
