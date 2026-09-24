CREATE TABLE "audit_logs" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100),
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"details" text,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"reference_code" varchar(30) NOT NULL,
	"property_id" varchar(100) NOT NULL,
	"guest_id" varchar(100),
	"guest_first_name" varchar(100) NOT NULL,
	"guest_last_name" varchar(100) NOT NULL,
	"guest_email" varchar(255) NOT NULL,
	"guest_phone" varchar(30) NOT NULL,
	"guest_count" integer DEFAULT 1 NOT NULL,
	"check_in_date" varchar(10) NOT NULL,
	"check_out_date" varchar(10) NOT NULL,
	"number_of_nights" integer NOT NULL,
	"nightly_price" integer NOT NULL,
	"cleaning_fee" integer DEFAULT 0 NOT NULL,
	"service_fee" integer DEFAULT 0 NOT NULL,
	"total_amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"access_token" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_reference_code_unique" UNIQUE("reference_code"),
	CONSTRAINT "bookings_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"bio" text,
	"response_rate" varchar(10) DEFAULT '100%',
	"response_time" varchar(50) DEFAULT 'Within an hour',
	"joined_year" integer DEFAULT 2026,
	"is_verified" boolean DEFAULT false,
	"identity_document_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone" varchar(30),
	"role" varchar(20) DEFAULT 'guest' NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "availability_blocks" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"property_id" varchar(100) NOT NULL,
	"start_date" varchar(10) NOT NULL,
	"end_date" varchar(10) NOT NULL,
	"type" varchar(30) DEFAULT 'RESERVATION' NOT NULL,
	"booking_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"host_id" varchar(100) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"tagline" text,
	"description" text NOT NULL,
	"property_type" varchar(50) NOT NULL,
	"space_type" varchar(50) DEFAULT 'Entire place' NOT NULL,
	"bedrooms" integer DEFAULT 1 NOT NULL,
	"bathrooms" double precision DEFAULT 1 NOT NULL,
	"beds" integer DEFAULT 1 NOT NULL,
	"max_guests" integer DEFAULT 2 NOT NULL,
	"price_per_night" integer NOT NULL,
	"cleaning_fee" integer DEFAULT 0 NOT NULL,
	"service_fee_pct" integer DEFAULT 8 NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"minimum_nights" integer DEFAULT 1 NOT NULL,
	"city" varchar(100) NOT NULL,
	"neighborhood" varchar(150) NOT NULL,
	"state" varchar(100) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"power_type" varchar(100) NOT NULL,
	"power_description" text,
	"internet_description" text,
	"security_description" text,
	"water_description" text,
	"parking_description" text,
	"cover_image" text NOT NULL,
	"status" varchar(30) DEFAULT 'PENDING_REVIEW' NOT NULL,
	"rejection_reason" text,
	"rating" double precision DEFAULT 5 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "property_amenities" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"property_id" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"is_highlight" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_images" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"property_id" varchar(100) NOT NULL,
	"url" text NOT NULL,
	"storage_key" varchar(255),
	"display_order" integer DEFAULT 0 NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_private_details" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"property_id" varchar(100) NOT NULL,
	"exact_address" text NOT NULL,
	"unit_number" varchar(50),
	"contact_name" varchar(100) NOT NULL,
	"contact_phone" varchar(30) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"check_in_instructions" text,
	"access_gate_code" varchar(50),
	"house_rules_private" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_private_details_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "host_earnings" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"host_id" varchar(100) NOT NULL,
	"booking_id" varchar(100) NOT NULL,
	"gross_amount" integer NOT NULL,
	"commission_amount" integer NOT NULL,
	"net_amount" integer NOT NULL,
	"status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"booking_id" varchar(100) NOT NULL,
	"reference" varchar(100) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"method" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'INITIALIZED' NOT NULL,
	"gateway_provider" varchar(50) DEFAULT 'MOCK_NIGERIAN_GATEWAY' NOT NULL,
	"gateway_reference" varchar(100),
	"paid_at" timestamp with time zone,
	"raw_payload" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"property_id" varchar(100) NOT NULL,
	"booking_id" varchar(100) NOT NULL,
	"guest_id" varchar(100) NOT NULL,
	"overall_rating" integer NOT NULL,
	"cleanliness_rating" integer,
	"accuracy_rating" integer,
	"location_rating" integer,
	"value_rating" integer,
	"communication_rating" integer,
	"infrastructure_rating" integer,
	"title" varchar(200),
	"body" text,
	"host_response" text,
	"host_responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "location_search_cache" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"query" varchar(255) NOT NULL,
	"results" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_search_cache_query_unique" UNIQUE("query")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_id_users_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_private_details" ADD CONSTRAINT "property_private_details_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_earnings" ADD CONSTRAINT "host_earnings_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_earnings" ADD CONSTRAINT "host_earnings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_guest_id_users_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;