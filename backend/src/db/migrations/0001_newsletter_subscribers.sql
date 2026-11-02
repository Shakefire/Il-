CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
  "id" varchar(100) PRIMARY KEY NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
