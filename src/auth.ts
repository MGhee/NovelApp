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
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { id: profile.sub },
        })

        // Create user if new, and assign orphaned books to them
        if (!existingUser) {
          await prisma.user.create({
            data: {
              id: profile.sub,
              email: profile.email,
              name: profile.name || null,
              picture: profile.picture || null,
            },
          })

          // Assign all books with no owner to this user (first login only)
          await prisma.book.updateMany({
            where: { userId: null },
            data: { userId: profile.sub },
          })
        } else {
          // Update existing user info
          await prisma.user.update({
            where: { id: profile.sub },
            data: {
              name: profile.name || undefined,
              picture: profile.picture || undefined,
            },
          })
        }
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
