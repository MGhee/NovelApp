'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'

interface User {
  id: string
  email: string
  name?: string | null
  picture?: string | null
}

interface ApiToken {
  id: number
  label: string
  createdAt: string
  lastUsedAt?: string | null
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [newToken, setNewToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUserProfile()
    fetchTokens()
  }, [])

  async function fetchUserProfile() {
    try {
      const res = await fetch('/api/user/profile')
      if (!res.ok) throw new Error('Failed to fetch profile')
      const data = await res.json()
      setUser(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function fetchTokens() {
    try {
      const res = await fetch('/api/user/tokens')
      if (!res.ok) throw new Error('Failed to fetch tokens')
      const data = await res.json()
      setTokens(data.tokens)
    } catch (err) {
      console.error('Error fetching tokens:', err)
    }
  }

  async function generateToken() {
    if (!newTokenLabel.trim()) {
      setError('Label is required')
      return
    }

    try {
      const res = await fetch('/api/user/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newTokenLabel }),
      })

      if (!res.ok) throw new Error('Failed to generate token')

      const data = await res.json()
      setNewToken(data.token)
      setNewTokenLabel('')
      fetchTokens() // Refresh list
    } catch (err) {
      setError(String(err))
    }
  }

  async function revokeToken(tokenId: number) {
    if (!confirm('Are you sure you want to revoke this token?')) return

    try {
      const res = await fetch('/api/user/tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tokenId }),
      })

      if (!res.ok) throw new Error('Failed to revoke token')

      fetchTokens() // Refresh list
    } catch (err) {
      setError(String(err))
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(newToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="max-w-2xl mx-auto p-8">
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--accent)' }}>
          ← Back to Library
        </Link>

        {/* Profile Section */}
        <div style={{ marginTop: '2rem', borderBottom: '1px solid var(--border)' }}>
          <h1>Settings</h1>

          {user && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
              {user.picture && (
                <img
                  src={user.picture}
                  alt={user.name || 'User'}
                  style={{ width: '64px', height: '64px', borderRadius: '50%' }}
                />
              )}
              <div>
                <h2>{user.name}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{user.email}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '2rem',
            }}
          >
            Sign Out
          </button>
        </div>

        {/* API Tokens Section */}
        <div style={{ marginTop: '2rem' }}>
          <h2>API Tokens for Browser Extension</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Generate personal API tokens to use with the browser extension. Keep them secret!
          </p>

          {error && (
            <div style={{ padding: '1rem', background: '#dc2626', color: '#fff', borderRadius: '4px', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {/* New Token Generated */}
          {newToken && (
            <div
              style={{
                padding: '1rem',
                background: 'var(--success)',
                color: '#fff',
                borderRadius: '4px',
                marginBottom: '1rem',
              }}
            >
              <p style={{ marginBottom: '0.5rem' }}>Token generated! Copy it now (won't be shown again):</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <code
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                    wordBreak: 'break-all',
                  }}
                >
                  {newToken}
                </code>
                <button
                  onClick={copyToClipboard}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(0,0,0,0.3)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Generate New Token */}
          <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--surface)', borderRadius: '4px' }}>
            <h3>Generate New Token</h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                type="text"
                placeholder="e.g., Chrome Extension"
                value={newTokenLabel}
                onChange={(e) => setNewTokenLabel(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                }}
              />
              <button
                onClick={generateToken}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Generate
              </button>
            </div>
          </div>

          {/* Token List */}
          <h3>Your Tokens</h3>
          {tokens.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No tokens yet. Create one above.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {tokens.map((token) => (
                <div
                  key={token.id}
                  style={{
                    padding: '1rem',
                    background: 'var(--surface)',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 'bold' }}>{token.label}</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Created {new Date(token.createdAt).toLocaleDateString()}
                      {token.lastUsedAt && ` • Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => revokeToken(token.id)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      background: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
