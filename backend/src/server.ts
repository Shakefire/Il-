import { buildApp } from "./app";
import { env } from "./config/env";
import { bookingsService } from "./modules/bookings/bookings.service";

async function main() {
  const app = await buildApp();

  const port = env.PORT;
  const host = "0.0.0.0";

  try {
    const address = await app.listen({ port, host });
    console.log(`\n🚀 [Ilé API] Fastify server running on ${address}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   Database:    ${env.DATABASE_URL ? "PostgreSQL (remote)" : "PGlite (embedded)"}`);
    console.log(`   Email:       ${env.EMAIL_PROVIDER}`);
    console.log(
      `   Payments:    ${
        env.PAYSTACK_SECRET_KEY
          ? "Paystack"
          : env.NODE_ENV === "production"
            ? "UNCONFIGURED (fail-closed)"
            : "Mock (dev/test only)"
      }`
    );
    console.log(`   ─────────────────────────────────────`);
    console.log(`   Auth:        ${address}/api/auth`);
    console.log(`   Properties:  ${address}/api/properties`);
    console.log(`   Search:      ${address}/api/search`);
    console.log(`   Bookings:    ${address}/api/bookings`);
    console.log(`   Host:        ${address}/api/host`);
    console.log(`   Admin:       ${address}/api/admin`);
    console.log(`   Reviews:     ${address}/api/reviews\n`);

    // Background worker for expiring overdue booking holds (host deadline 120s / pay deadline 10m)
    let isExpiring = false;
    const expireTimer = setInterval(async () => {
      if (isExpiring) return;
      isExpiring = true;
      try {
        const res = await bookingsService.expireDueBookings(50);
        if (res.expired > 0) {
          console.log(
            `[Worker] Expired ${res.expired} due booking(s) (host=${res.hostExpired}, pay=${res.paymentExpired})`
          );
        }
      } catch (err) {
        console.warn("[Worker] Error running expireDueBookings:", err);
      } finally {
        isExpiring = false;
      }
    }, 15000);
    expireTimer.unref?.();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
