import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/supabase";
import type { Role } from "@/lib/roles";
import { normalizePhone, phoneVariants } from "@/lib/identity";
import { verifyOtp } from "@/lib/otp";
import { ensureAuthUrl } from "@/lib/auth-url";

ensureAuthUrl();

// Session cookie lifetime (Auth.js JWT maxAge). Keep this the single source of
// truth — a second absExp kill was causing /api/upload 401s while the admin UI
// still looked signed in after soft navigation.
const MAX_SESSION_SECONDS = 24 * 60 * 60;

declare module "next-auth" {
  interface User {
    role: Role;
    roleKey?: string | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: Role;
      roleKey?: string | null;
    };
  }
}

const passwordLoginSchema = z.object({
  loginMethod: z.literal("password").optional(),
  email: z.string().email(),
  password: z.string().min(6),
});

const phoneOtpLoginSchema = z.object({
  loginMethod: z.literal("phone-otp"),
  phone: z.string().min(10),
  otpId: z.string().min(1),
  otpCode: z.string().min(4).max(8),
});

async function findUserByPhone(phoneRaw: string) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) return null;
  const variants = phoneVariants(phone);
  const { data: user } = await db
    .from("User")
    .select("id, email, name, image, role, roleKey, phone")
    .in("phone", variants)
    .limit(1)
    .maybeSingle();
  return user;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: MAX_SESSION_SECONDS },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        loginMethod: { label: "Method", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        phone: { label: "Phone", type: "text" },
        otpId: { label: "OTP ID", type: "text" },
        otpCode: { label: "OTP code", type: "text" },
      },
      async authorize(raw) {
        const method = String(raw?.loginMethod || "password");

        if (method === "phone-otp") {
          const parsed = phoneOtpLoginSchema.safeParse({
            loginMethod: "phone-otp",
            phone: raw?.phone,
            otpId: raw?.otpId,
            otpCode: raw?.otpCode,
          });
          if (!parsed.success) return null;

          const otp = await verifyOtp({
            otpId: parsed.data.otpId,
            code: parsed.data.otpCode,
            destination: parsed.data.phone,
          });
          if (!otp.ok || otp.channel !== "phone") return null;

          const user = await findUserByPhone(otp.destination);
          if (!user?.email) return null;

          return {
            id: user.id as string,
            email: user.email as string,
            name: user.name as string | null,
            image: user.image as string | null,
            role: user.role as Role,
            roleKey: (user.roleKey as string | null) ?? null,
          };
        }

        const parsed = passwordLoginSchema.safeParse({
          loginMethod: "password",
          email: raw?.email,
          password: raw?.password,
        });
        if (!parsed.success) return null;

        const { data: user } = await db
          .from("User")
          .select("id, email, name, image, role, roleKey, passwordHash")
          .eq("email", parsed.data.email.toLowerCase())
          .maybeSingle();
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash as string,
        );
        if (!valid) return null;

        return {
          id: user.id as string,
          email: user.email as string,
          name: user.name as string | null,
          image: user.image as string | null,
          role: user.role as Role,
          roleKey: (user.roleKey as string | null) ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.sub = user.id!;
        token.role = user.role;
        token.roleKey = user.roleKey ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      const id = (token.id as string | undefined) || token.sub;
      if (!id || !session.user) return session;
      session.user.id = String(id);
      session.user.role = (token.role as Role) || "TOURIST";
      session.user.roleKey = (token.roleKey as string | null) ?? null;
      return session;
    },
  },
});
