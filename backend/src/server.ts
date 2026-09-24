import { buildApp } from "./app";
import { env } from "./config/env";

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
    console.log(`   Payments:    ${env.PAYSTACK_SECRET_KEY ? "Paystack (live)" : "Mock (dev)"}`);
    console.log(`   ─────────────────────────────────────`);
    console.log(`   Auth:        ${address}/api/auth`);
    console.log(`   Properties:  ${address}/api/properties`);
    console.log(`   Search:      ${address}/api/search`);
    console.log(`   Bookings:    ${address}/api/bookings`);
    console.log(`   Host:        ${address}/api/host`);
    console.log(`   Admin:       ${address}/api/admin`);
    console.log(`   Reviews:     ${address}/api/reviews\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
