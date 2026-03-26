"use client"
import { signIn } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState, Suspense } from "react"

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    // Check if already authenticated by trying to fetch a protected route
    fetch("/api/books?limit=1")
      .then((res) => {
        if (res.ok) {
          // Already authenticated, redirect
          const from = searchParams.get("from") || "/"
          router.replace(from)
        }
      })
      .catch(() => {})
      .finally(() => setCheckingAuth(false))
  }, [router, searchParams])

  if (checkingAuth) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      </div>
    )
  }

  async function handleGoogleSignIn() {
    setLoading(true)
    const from = searchParams.get("from") || "/"
    await signIn("google", { redirectTo: from })
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 360, padding: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}>
        <h2 style={{ margin: 0, marginBottom: 8, textAlign: "center" }}>NovelShelf</h2>
        <p style={{ margin: 0, marginBottom: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Reading tracker for web novels</p>
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 16px",
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in…" : "Sign in with Google"}
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>Loading…</div>}>
      <LoginPageInner />
    </Suspense>
  )
}
