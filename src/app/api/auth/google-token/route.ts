import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { createSessionCookie } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const googleClientId = process.env.GOOGLE_CLIENT_ID

export async function POST(req: NextRequest) {
  if (!googleClientId) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { idToken } = body

    if (!idToken) {
      return NextResponse.json(
        { error: 'Missing idToken' },
        { status: 400 }
      )
    }

    // Verify the Google ID token
    const client = new OAuth2Client(googleClientId)
    const ticket = await client.verifyIdToken({
      idToken,
      audience: googleClientId,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token payload' },
        { status: 401 }
      )
    }

    // Optionally check if email is allowed (via ALLOWED_GOOGLE_EMAILS env var)
    const allowedEmails = process.env.ALLOWED_GOOGLE_EMAILS
      ? process.env.ALLOWED_GOOGLE_EMAILS.split(',').map(e => e.trim())
      : null

    if (allowedEmails && !allowedEmails.includes(payload.email || '')) {
      return NextResponse.json(
        { error: 'Email not authorized' },
        { status: 403 }
      )
    }

    const userId = payload.sub
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid user ID from Google' },
        { status: 401 }
      )
    }

    // Upsert User record (create or update)
    await prisma.user.upsert({
      where: { id: userId },
      update: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
      create: {
        id: userId,
        email: payload.email!,
        name: payload.name || null,
        picture: payload.picture || null,
      },
    })

    // Create a session token with userId embedded
    const sessionToken = await createSessionCookie(userId)

    return NextResponse.json({
      sessionToken,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    })
  } catch (error) {
    console.error('Google token verification error:', error)
    return NextResponse.json(
      { error: 'Failed to verify token' },
      { status: 401 }
    )
  }
}
