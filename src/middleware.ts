import { auth } from "./auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/api/auth"]

function originAllowed(origin: string | null, allowList: string[]) {
  if (!origin) return false
  if (allowList.length === 0) return true
  if (allowList.includes("*")) return true
  try {
    const o = new URL(origin)
    return allowList.some((a) => {
      try {
        const aa = new URL(a)
        return aa.host === o.host && aa.protocol === o.protocol
      } catch {
        return a === origin
      }
    })
  } catch {
    return false
  }
}

function parseAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGIN || ""
  if (!raw) return []
  return raw.split(",").map((s) => s.trim()).filter(Boolean)
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl
  const origin = req.headers.get("origin")
  const allowList = parseAllowedOrigins()

  // Handle CORS preflight
  if (pathname.startsWith("/api/") && req.method === "OPTIONS") {
    const res = NextResponse.json({})
    if (origin && originAllowed(origin, allowList)) {
      res.headers.set("Access-Control-Allow-Origin", origin)
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
      res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
      res.headers.set("Access-Control-Max-Age", "600")
    }
    return res
  }

  // Skip static assets
  if (pathname.startsWith("/_next/static") || pathname.startsWith("/_next/image") || pathname === "/favicon.ico") {
    return NextResponse.next()
  }

  // Public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check OAuth session
  const session = req.auth
  if (session) {
    // Authenticated via OAuth
    const res = NextResponse.next()
    if (pathname.startsWith("/api/") && origin && originAllowed(origin, allowList)) {
      res.headers.set("Access-Control-Allow-Origin", origin)
      res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    }
    return res
  }

  // Check Bearer token (for extension/API access)
  const authHeader = req.headers.get("authorization")
  const SECRET = process.env.AUTH_SECRET || ""
  if (SECRET && authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    if (match && match[1] === SECRET) {
      const res = NextResponse.next()
      if (origin && originAllowed(origin, allowList)) {
        res.headers.set("Access-Control-Allow-Origin", origin)
        res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
      }
      return res
    }
  }

  // Unauthenticated
  if (pathname.startsWith("/api/")) {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (origin && originAllowed(origin, allowList)) {
      res.headers.set("Access-Control-Allow-Origin", origin)
      res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    }
    return res
  }

  // Page request - redirect to login
  const loginUrl = new URL("/login", req.nextUrl.origin)
  loginUrl.searchParams.set("from", pathname + req.nextUrl.search)
  return NextResponse.redirect(loginUrl)
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
