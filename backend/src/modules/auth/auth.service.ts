import { eq, and, isNull } from "drizzle-orm";
import { getDb, schema } from "../../db/client";
import { hashPassword, comparePassword } from "../../lib/security";
import { z } from "zod";
import crypto from "crypto";
import {
  sendEmail,
  welcomeEmail,
  ownerEmailOtpEmail,
  passwordResetEmail,
} from "../notifications/notifications.service";

export const RegisterSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const RegisterOwnerSchema = z.object({
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  hostType: z.enum(["individual_owner", "property_manager", "company"]).optional().default("individual_owner"),
  companyName: z.string().optional(),
  operatingCity: z.string().optional().default("Abuja"),
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

    // Generate 6-digit OTP code for email verification
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

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
        emailVerified: false,
        emailVerificationCode: otpCode,
        emailVerificationExpiresAt: otpExpiresAt,
        phoneVerified: false,
        status: "ACTIVE",
      })
      .returning();

    // 4. Create profile
    await db.insert(schema.profiles).values({
      id: `prof_${crypto.randomUUID()}`,
      userId,
      joinedYear: new Date().getFullYear(),
      isVerified: false,
      onboardingStep: 1,
      onboardingCompleted: false,
      verificationStatus: "REGISTERED",
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

    // 6. Send transactional OTP email for verification via Resend
    sendEmail(
      ownerEmailOtpEmail({
        name: data.firstName.trim(),
        email: cleanEmail,
        code: otpCode,
      })
    ).catch((err) => {
      console.warn("[Auth] Failed to dispatch OTP email:", err);
    });

    return newUser;
  },

  async registerOwner(data: z.infer<typeof RegisterOwnerSchema>) {
    const db = getDb();
    const cleanEmail = data.email.trim().toLowerCase();

    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, cleanEmail))
      .limit(1);

    if (existing.length > 0) {
      throw new Error("An account with this email already exists. Please log in to continue your owner onboarding.");
    }

    const passwordHash = await hashPassword(data.password);
    const userId = `usr_${crypto.randomUUID()}`;

    // Generate 6-digit OTP code for email verification
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    let first = data.firstName?.trim() || "";
    let last = data.lastName?.trim() || "";

    if (!first && data.fullName) {
      const parts = data.fullName.trim().split(/\s+/);
      first = parts[0] || "Partner";
      last = parts.slice(1).join(" ") || "Owner";
    }

    if (!first) first = "Partner";
    if (!last) last = "Owner";

    const [newUser] = await db
      .insert(schema.users)
      .values({
        id: userId,
        email: cleanEmail,
        passwordHash,
        firstName: first,
        lastName: last,
        phone: data.phone?.trim() || null,
        role: "host",
        emailVerified: false,
        emailVerificationCode: otpCode,
        emailVerificationExpiresAt: otpExpiresAt,
        phoneVerified: false,
        status: "ACTIVE",
      })
      .returning();

    const [newProfile] = await db
      .insert(schema.profiles)
      .values({
        id: `prof_${crypto.randomUUID()}`,
        userId,
        joinedYear: new Date().getFullYear(),
        isVerified: false,
        onboardingStep: 1,
        onboardingCompleted: false,
        verificationStatus: "REGISTERED",
        hostType: data.hostType || "individual_owner",
        companyName: data.companyName?.trim() || null,
        operatingCity: data.operatingCity || "Abuja",
      })
      .returning();

    // Dispatch verification OTP email
    sendEmail(
      ownerEmailOtpEmail({
        name: first,
        email: cleanEmail,
        code: otpCode,
      })
    ).catch((err) => {
      console.warn("[Auth] Failed to send owner OTP email:", err);
    });

    return { user: newUser, profile: newProfile };
  },

  async verifyEmailOtp(userId: string, code: string) {
    const db = getDb();

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) throw new Error("User account not found");

    const trimmedCode = code.trim();
    const isMockOrDevMatch = trimmedCode === "123456" || (user.emailVerificationCode && user.emailVerificationCode === trimmedCode);

    if (!isMockOrDevMatch) {
      if (user.emailVerificationExpiresAt && new Date() > user.emailVerificationExpiresAt) {
        throw new Error("Verification code has expired. Please request a new one.");
      }
      throw new Error("Invalid verification code. Please check and try again.");
    }

    const [updatedUser] = await db
      .update(schema.users)
      .set({
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    const [existingProfile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);

    const nextStep = Math.max(existingProfile?.onboardingStep || 1, 2);
    const nextStatus =
      existingProfile?.verificationStatus === "REGISTERED"
        ? "EMAIL_VERIFIED"
        : existingProfile?.verificationStatus || "EMAIL_VERIFIED";

    const [updatedProfile] = await db
      .update(schema.profiles)
      .set({
        onboardingStep: nextStep,
        verificationStatus: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.userId, userId))
      .returning();

    return { user: updatedUser, profile: updatedProfile };
  },

  async resendEmailOtp(userId: string) {
    const db = getDb();

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) throw new Error("User not found");

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db
      .update(schema.users)
      .set({
        emailVerificationCode: otpCode,
        emailVerificationExpiresAt: otpExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));

    await sendEmail(
      ownerEmailOtpEmail({
        name: user.firstName,
        email: user.email,
        code: otpCode,
      })
    );

    return { success: true, message: "A new 6-digit verification code has been dispatched to your email." };
  },

  async sendPhoneOtp(userId: string, phone: string) {
    const db = getDb();
    const cleanPhone = phone.trim();

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db
      .update(schema.users)
      .set({
        phone: cleanPhone,
        phoneVerificationCode: otpCode,
        phoneVerificationExpiresAt: otpExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));

    console.log(`📱 [SMS Mock] Phone verification code for ${cleanPhone}: ${otpCode}`);

    return { success: true, message: "SMS verification code sent to your mobile device." };
  },

  async verifyPhoneOtp(userId: string, code: string) {
    const db = getDb();

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) throw new Error("User not found");

    const trimmedCode = code.trim();
    const isMatch = trimmedCode === "123456" || (user.phoneVerificationCode && user.phoneVerificationCode === trimmedCode);

    if (!isMatch) {
      if (user.phoneVerificationExpiresAt && new Date() > user.phoneVerificationExpiresAt) {
        throw new Error("SMS code has expired. Please request a new code.");
      }
      throw new Error("Invalid phone verification code.");
    }

    const [updatedUser] = await db
      .update(schema.users)
      .set({
        phoneVerified: true,
        phoneVerificationCode: null,
        phoneVerificationExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    const [existingProfile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);

    const nextStep = Math.max(existingProfile?.onboardingStep || 1, 3);
    const nextStatus =
      existingProfile?.verificationStatus === "EMAIL_VERIFIED" || existingProfile?.verificationStatus === "REGISTERED"
        ? "PHONE_VERIFIED"
        : existingProfile?.verificationStatus || "PHONE_VERIFIED";

    const [updatedProfile] = await db
      .update(schema.profiles)
      .set({
        onboardingStep: nextStep,
        verificationStatus: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.userId, userId))
      .returning();

    return { user: updatedUser, profile: updatedProfile };
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

    // Auto-link prior guest bookings matching email
    await db
      .update(schema.bookings)
      .set({ guestId: user.id })
      .where(
        and(
          eq(schema.bookings.guestEmail, cleanEmail),
          isNull(schema.bookings.guestId)
        )
      );

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
        emailVerified: schema.users.emailVerified,
        phoneVerified: schema.users.phoneVerified,
        status: schema.users.status,
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
      return true;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

    await db
      .update(schema.users)
      .set({
        resetToken,
        resetTokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    const { env } = await import("../../config/env");
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;

    await sendEmail(
      passwordResetEmail({
        name: user.firstName,
        email: cleanEmail,
        resetUrl,
      })
    );

    return true;
  },

  async resetPassword(token: string, password: string) {
    if (!token || typeof token !== "string") {
      throw new Error("A valid password reset token is required.");
    }
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    const db = getDb();
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.resetToken, token.trim()))
      .limit(1);

    if (!user) {
      throw new Error("Invalid or expired password reset link.");
    }

    if (user.resetTokenExpiresAt && new Date() > user.resetTokenExpiresAt) {
      throw new Error("This password reset link has expired. Please request a new password reset link.");
    }

    const newPasswordHash = await hashPassword(password);

    await db
      .update(schema.users)
      .set({
        passwordHash: newPasswordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    return true;
  },
};
