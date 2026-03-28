import NextAuth from "next-auth"
import Google from "@auth/core/providers/google"
import { prisma } from "@/lib/prisma"

export const runtime = 'nodejs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Auto-create or update User record on successful Google sign-in
      if (account?.provider === 'google' && profile?.sub && profile?.email) {
        await prisma.user.upsert({
          where: { id: profile.sub },
          update: {
            name: profile.name || undefined,
            picture: profile.picture || undefined,
          },
          create: {
            id: profile.sub,
            email: profile.email,
            name: profile.name || null,
            picture: profile.picture || null,
          },
        })
      }
      return true
    },
    async jwt({ token, account, profile }) {
      // Use Google ID as the token subject to match the database user ID
      if (account?.provider === 'google' && profile?.sub) {
        token.sub = profile.sub
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || ""
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
