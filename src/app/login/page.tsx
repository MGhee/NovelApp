"use client"
import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params?.get('from') || '/'
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    if (res.ok) {
      router.push(from)
    } else if (res.status === 401) {
      setError('Incorrect password')
    } else {
      setError('Login failed')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={submit} style={{ width: 360, padding: 24, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
        <h2 style={{ margin: 0, marginBottom: 12 }}>Sign in</h2>
        <div style={{ marginBottom: 12 }}>
          <input autoFocus type="password" placeholder="API Key / Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'inherit' }} />
        </div>
        {error && <div style={{ color: 'var(--accent)', marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading} style={{ flex: 1, padding: '8px 12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4 }}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </div>
      </form>
    </div>
  )
}
