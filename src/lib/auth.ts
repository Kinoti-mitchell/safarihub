import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { getPlatformSettings, numberSetting } from "@/lib/settings";
import type { Role } from "@/lib/roles";
import { normalizePhone, phoneVariants } from "@/lib/identity";
import { verifyOtp } from "@/lib/otp";

// Hard ceiling for the session cookie — the finer-grained, admin-configurable
// limit (in minutes) is enforced in the jwt callback below.
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
        token.role = user.role;
        token.roleKey = user.roleKey ?? null;
        // Stamp an absolute expiry at login based on the configured minutes.
        // Floor at 2h so admin console uploads/nav don't die mid-review.
        const settings = await getPlatformSettings();
        const configured =
          numberSetting(settings, "security.sessionMinutes") || 120;
        const minutes = Math.max(120, configured);
        token.absExp = Date.now() + minutes * 60_000;
      }
      // Enforce the absolute session lifetime — no multi-day sessions.
      if (token.absExp && Date.now() > Number(token.absExp)) {
        return null;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token?.id) {
        return session;
      }
      if (session.user) {
        session.user.id = String(token.id);
        session.user.role = token.role as Role;
        session.user.roleKey = (token.roleKey as string | null) ?? null;
      }
      return session;
    },
  },
});
