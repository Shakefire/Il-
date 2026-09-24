import { eq, and, isNull } from "drizzle-orm";
import { getDb, schema } from "../../db/client";
import { hashPassword, comparePassword } from "../../lib/security";
import { z } from "zod";
import crypto from "crypto";

export const RegisterSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const LoginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

export const authService = {
  async registerUser(data: z.infer<typeof RegisterSchema>) {
    const db = getDb();
    const cleanEmail = data.email.trim().toLowerCase();

    // 1. Check for existing email (case-insensitive)
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, cleanEmail))
      .limit(1);

    if (existing.length > 0) {
      throw new Error("An account with this email already exists. Please log in.");
    }

    // 2. Hash password
    const passwordHash = await hashPassword(data.password);
    const userId = `usr_${crypto.randomUUID()}`;

    // 3. Create user
    const [newUser] = await db
      .insert(schema.users)
      .values({
        id: userId,
        email: cleanEmail,
        passwordHash,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        phone: data.phone?.trim() || null,
        role: "guest",
      })
      .returning();

    // 4. Create profile
    await db.insert(schema.profiles).values({
      id: `prof_${crypto.randomUUID()}`,
      userId,
      joinedYear: new Date().getFullYear(),
      isVerified: false,
    });

    // 5. Auto-link prior guest bookings matching email
    await db
      .update(schema.bookings)
      .set({ guestId: userId })
      .where(
        and(
          eq(schema.bookings.guestEmail, cleanEmail),
          isNull(schema.bookings.guestId)
        )
      );

    // 6. Send transactional welcome email via Resend
    import("../notifications/notifications.service").then(({ sendEmail, welcomeEmail }) => {
      sendEmail(welcomeEmail({ name: data.firstName.trim(), email: cleanEmail })).catch((err) => {
        console.warn("[Auth] Failed to dispatch welcome email:", err);
      });
    });

    return newUser;
  },

  async loginUser(email: string, password: string) {
    const db = getDb();
    const cleanEmail = email.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, cleanEmail))
      .limit(1);

    if (!user) {
      throw new Error("Invalid credentials. Please check your email and password.");
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      throw new Error("Invalid credentials. Please check your email and password.");
    }

    return user;
  },

  async getCurrentUser(userId: string) {
    const db = getDb();

    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        phone: schema.users.phone,
        role: schema.users.role,
        avatarUrl: schema.users.avatarUrl,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) return null;

    const [profile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id))
      .limit(1);

    return { ...user, profile: profile || null };
  },

  async requestPasswordReset(email: string) {
    const db = getDb();
    const cleanEmail = email.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, cleanEmail))
      .limit(1);

    if (!user) {
      // Return true to avoid user enumeration
      return true;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const { env } = await import("../../config/env");
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;

    const { sendEmail, passwordResetEmail } = await import("../notifications/notifications.service");
    await sendEmail(passwordResetEmail({
      name: user.firstName,
      email: cleanEmail,
      resetUrl,
    }));

    return true;
  },

  async resetPassword(_token: string, _password: string) {
    return true;
  },
};
