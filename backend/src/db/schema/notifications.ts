import {
  pgTable,
  varchar,
  timestamp,
  integer,
  text,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./users"

/**
 * Durable email delivery ledger for Phase 6 idempotent Resend sends.
 * Failures are logged; booking mutations never roll back on email failure.
 */
export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    idempotencyKey: varchar("idempotency_key", { length: 191 }).notNull(),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull().default("booking"),
    entityId: varchar("entity_id", { length: 100 }),
    recipient: varchar("recipient", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 500 }),
    status: varchar("status", { length: 30 }).notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    providerMessageId: varchar("provider_message_id", { length: 191 }),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex("email_deliveries_idempotency_uidx").on(table.idempotencyKey),
  })
)

/** Push / web-push device tokens registered by authenticated clients. */
export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    userId: varchar("user_id", { length: 100 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: varchar("platform", { length: 30 }).notNull(), // ios | android | web
    provider: varchar("provider", { length: 30 }).notNull().default("fcm"), // fcm | web_push
    appVersion: varchar("app_version", { length: 40 }),
    userAgent: text("user_agent"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenUidx: uniqueIndex("device_tokens_token_uidx").on(table.token),
    userIdx: index("device_tokens_user_idx").on(table.userId),
  })
)

/** In-app notification inbox (guest + host). */
export const notificationInbox = pgTable(
  "notification_inbox",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    userId: varchar("user_id", { length: 100 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    entityType: varchar("entity_type", { length: 50 }).default("booking"),
    entityId: varchar("entity_id", { length: 100 }),
    deepLink: varchar("deep_link", { length: 500 }),
    idempotencyKey: varchar("idempotency_key", { length: 191 }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyUidx: uniqueIndex("notification_inbox_idempotency_uidx").on(table.idempotencyKey),
    userCreatedIdx: index("notification_inbox_user_created_idx").on(table.userId, table.createdAt),
  })
)

/**
 * Multi-channel delivery outbox / ledger (sms, push, web_push).
 * Email continues to use email_deliveries; this covers other channels.
 */
export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    idempotencyKey: varchar("idempotency_key", { length: 191 }).notNull(),
    channel: varchar("channel", { length: 30 }).notNull(), // sms | push | web_push | inbox
    eventType: varchar("event_type", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull().default("booking"),
    entityId: varchar("entity_id", { length: 100 }),
    userId: varchar("user_id", { length: 100 }),
    recipient: varchar("recipient", { length: 500 }).notNull(),
    payloadSummary: text("payload_summary"),
    status: varchar("status", { length: 30 }).notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    providerMessageId: varchar("provider_message_id", { length: 191 }),
    lastError: text("last_error"),
    mockMode: boolean("mock_mode").default(false).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyUidx: uniqueIndex("notification_deliveries_idempotency_uidx").on(
      table.idempotencyKey
    ),
  })
)

/**
 * Per-user channel preferences.
 * Critical security categories cannot be disabled (enforced in service layer).
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    userId: varchar("user_id", { length: 100 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 60 }).notNull(),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    smsEnabled: boolean("sms_enabled").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(true),
    inboxEnabled: boolean("inbox_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCategoryUidx: uniqueIndex("notification_preferences_user_category_uidx").on(
      table.userId,
      table.category
    ),
  })
)
