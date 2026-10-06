import { pgTable, varchar, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar("id", { length: 100 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  role: varchar("role", { length: 20 }).notNull().default("guest"),
  avatarUrl: text("avatar_url"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerificationCode: varchar("email_verification_code", { length: 10 }),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at", { withTimezone: true }),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  phoneVerificationCode: varchar("phone_verification_code", { length: 10 }),
  phoneVerificationExpiresAt: timestamp("phone_verification_expires_at", { withTimezone: true }),
  resetToken: varchar("reset_token", { length: 100 }),
  resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true }),
  status: varchar("status", { length: 30 }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: varchar("id", { length: 100 }).primaryKey(),
  userId: varchar("user_id", { length: 100 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio"),
  responseRate: varchar("response_rate", { length: 10 }).default("100%"),
  responseTime: varchar("response_time", { length: 50 }).default("Within an hour"),
  joinedYear: integer("joined_year").default(2026),
  isVerified: boolean("is_verified").default(false),
  identityDocumentUrl: text("identity_document_url"),
  // Onboarding lifecycle
  onboardingStep: integer("onboarding_step").default(1).notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  verificationStatus: varchar("verification_status", { length: 40 }).default("REGISTERED").notNull(),
  // Profile & Business classification
  hostType: varchar("host_type", { length: 40 }), // "individual_owner" | "property_manager" | "company"
  companyName: varchar("company_name", { length: 255 }),
  companyRegistrationNumber: varchar("company_reg_number", { length: 100 }),
  residentialAddress: text("residential_address"),
  dateOfBirth: varchar("date_of_birth", { length: 30 }),
  operatingCity: varchar("operating_city", { length: 100 }),
  operatingAreas: text("operating_areas"),
  // Identity / KYC
  idType: varchar("id_type", { length: 50 }), // "nin" | "drivers_license" | "passport" | "voters_card"
  idNumber: varchar("id_number", { length: 100 }),
  idDocumentBackUrl: text("id_document_back_url"),
  selfieUrl: text("selfie_url"),
  // Authority / Proof of Ownership
  authorityDocType: varchar("authority_doc_type", { length: 50 }), // "deed_of_ownership" | "management_agreement" | "utility_bill" | "cac_certificate" | "power_of_attorney"
  authorityDocUrl: text("authority_doc_url"),
  // Nigerian Bank Details for host payouts
  bankName: varchar("bank_name", { length: 100 }),
  bankCode: varchar("bank_code", { length: 20 }),
  bankAccountNumber: varchar("bank_account_number", { length: 20 }),
  bankAccountName: varchar("bank_account_name", { length: 150 }),
  // Preliminary property draft collected in onboarding
  propertyDraftData: text("property_draft_data"),
  // Admin review outcome
  reviewFeedback: text("review_feedback"),
  reviewedBy: varchar("reviewed_by", { length: 100 }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const verificationLogs = pgTable("verification_logs", {
  id: varchar("id", { length: 100 }).primaryKey(),
  hostId: varchar("host_id", { length: 100 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  adminId: varchar("admin_id", { length: 100 })
    .references(() => users.id, { onDelete: "set null" }),
  previousStatus: varchar("previous_status", { length: 40 }).notNull(),
  newStatus: varchar("new_status", { length: 40 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(), // "SUBMIT" | "APPROVE" | "REJECT" | "REQUEST_INFO" | "SUSPEND"
  reason: text("reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
