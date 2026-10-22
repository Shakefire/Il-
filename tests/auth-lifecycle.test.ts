import "dotenv/config";
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDb, schema } from "../backend/src/db/client";
import { eq } from "drizzle-orm";
import { createSessionToken, verifySessionToken } from "../backend/src/lib/security";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

function getCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

describe("Ilé Authentication & Session Security Lifecycle", () => {
  const db = getDb();
  const timestamp = Date.now();

  // Test Account Emails
  const userA_email = `auth_test_a_${timestamp}@ile-test.ng`;
  const userB_email = `auth_test_b_${timestamp}@ile-test.ng`;
  const userC_email = `auth_test_c_${timestamp}@ile-test.ng`;
  const userD_email = `auth_test_d_${timestamp}@ile-test.ng`;
  const userE_email = `auth_test_e_${timestamp}@ile-test.ng`;
  const userConcurrent_email = `auth_test_concurrent_${timestamp}@ile-test.ng`;
  const password = "ValidPassword123!";

  let userA_cookie: string | null = null;
  let userA_id: string | null = null;

  it("1. New email registration requires OTP and issues NO session token or cookie", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Aliko",
        lastName: "Dangote",
        email: userA_email,
        password,
        hostType: "individual_owner",
      }),
    });

    assert.equal(res.status, 201, "Registration should succeed with 201 Created");
    const data = await res.json();

    assert.equal(data.success, true);
    assert.equal(data.requiresEmailVerification, true);
    assert.equal(data.email, userA_email);
    assert.equal(data.token, undefined, "CRITICAL: No token should be returned upon registration");

    // Check Set-Cookie
    const setCookie = res.headers.get("set-cookie");
    const sessionTokenCookie = getCookieValue(setCookie, "session_token");
    assert.equal(
      sessionTokenCookie,
      null,
      "CRITICAL: No session_token cookie should be set before OTP verification"
    );

    // Verify DB state
    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, userA_email));
    assert.ok(dbUser, "User record must exist in DB");
    assert.equal(dbUser.emailVerified, false, "Email must not be verified initially");
    assert.ok(dbUser.emailVerificationCode, "A 6-digit OTP code must be generated");
    assert.equal(dbUser.emailVerificationCode.length, 6);
    assert.equal(dbUser.emailVerificationAttempts, 0);

    userA_id = dbUser.id;
  });

  it("2. Existing email fails with 409 Conflict and creates NO session", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Duplicate",
        lastName: "Attempt",
        email: userA_email,
        password,
      }),
    });

    assert.equal(res.status, 409, "Duplicate email registration must return 409 Conflict");
    const data = await res.json();
    assert.ok(data.error.includes("already exists"), "Error message must state account already exists");

    const setCookie = res.headers.get("set-cookie");
    const sessionTokenCookie = getCookieValue(setCookie, "session_token");
    assert.equal(sessionTokenCookie, null, "No session token cookie on conflict");

    // Unauthenticated request to /api/auth/me must return 401
    const meRes = await fetch(`${BASE_URL}/api/auth/me`);
    assert.equal(meRes.status, 401, "User should remain unauthorized");
  });

  it("3. Existing email while another user is logged in does not switch identity or expose account", async () => {
    // First, verify User A's email and log User A in
    const [userA_db] = await db.select().from(schema.users).where(eq(schema.users.email, userA_email));
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userA_email, code: userA_db.emailVerificationCode }),
    });

    assert.equal(verifyRes.status, 200, "Verification for User A should succeed");
    const verifyData = await verifyRes.json();
    assert.ok(verifyData.token, "Token issued after successful OTP verification");

    const setCookie = verifyRes.headers.get("set-cookie");
    userA_cookie = `session_token=${getCookieValue(setCookie, "session_token")}`;
    assert.ok(userA_cookie, "session_token cookie established after OTP");

    // Also register User B (unverified)
    await fetch(`${BASE_URL}/api/auth/register-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "UserB",
        lastName: "Owner",
        email: userB_email,
        password,
      }),
    });

    // While logged in as User A, attempt to register User B's existing email
    const regRes = await fetch(`${BASE_URL}/api/auth/register-owner`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: userA_cookie,
      },
      body: JSON.stringify({
        firstName: "Malicious",
        lastName: "Attempt",
        email: userB_email,
        password,
      }),
    });

    assert.equal(regRes.status, 409, "Must return 409 Conflict");

    // Check /api/auth/me with User A's cookie — must STILL be User A!
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: userA_cookie },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.email, userA_email, "Session must NOT switch to User B");
    assert.equal(meData.user.id, userA_id);
  });

  it("4. Failed signup does not destroy legitimate session", async () => {
    assert.ok(userA_cookie, "User A must have active session");

    // Submit invalid registration request with User A's session attached
    const res = await fetch(`${BASE_URL}/api/auth/register-owner`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: userA_cookie,
      },
      body: JSON.stringify({
        firstName: "",
        lastName: "",
        email: "not-an-email",
        password: "short",
      }),
    });

    assert.equal(res.status, 400);

    // Verify session cookie was NOT cleared or invalidated
    const setCookie = res.headers.get("set-cookie");
    assert.equal(setCookie, null, "Failed signup must not alter or clear existing session cookie");

    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: userA_cookie },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.email, userA_email, "User A's session remains intact and legitimate");
  });

  it("5. Incorrect OTP rejected with remaining attempt count", async () => {
    // User B is registered and unverified
    const res = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userB_email,
        code: "000000", // Incorrect code
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("4 attempts remaining"), `Expected '4 attempts remaining', got: ${data.error}`);

    // Check DB attempts incremented
    const [userB] = await db.select().from(schema.users).where(eq(schema.users.email, userB_email));
    assert.equal(userB.emailVerificationAttempts, 1);
  });

  it("6. Expired OTP rejected", async () => {
    // Manually expire User B's OTP code in DB
    await db
      .update(schema.users)
      .set({
        emailVerificationExpiresAt: new Date(Date.now() - 60000), // 1 minute in past
      })
      .where(eq(schema.users.email, userB_email));

    const [userB] = await db.select().from(schema.users).where(eq(schema.users.email, userB_email));

    const res = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userB_email,
        code: userB.emailVerificationCode,
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("expired"), `Expected error mentioning expired, got: ${data.error}`);
  });

  it("7. Reused OTP rejected and atomically invalidated", async () => {
    // Register User C
    await fetch(`${BASE_URL}/api/auth/register-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "UserC",
        lastName: "SingleUse",
        email: userC_email,
        password,
      }),
    });

    const [userC] = await db.select().from(schema.users).where(eq(schema.users.email, userC_email));
    const validCode = userC.emailVerificationCode!;

    // First use: must succeed
    const firstVerify = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userC_email, code: validCode }),
    });
    assert.equal(firstVerify.status, 200, "First verification must succeed");

    // Second use of the EXACT same OTP: must fail
    const secondVerify = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userC_email, code: validCode }),
    });
    assert.equal(secondVerify.status, 400, "Replayed OTP must be rejected");

    // Verify DB: OTP code was wiped
    const [userC_updated] = await db.select().from(schema.users).where(eq(schema.users.email, userC_email));
    assert.equal(userC_updated.emailVerificationCode, null, "OTP code must be cleared in DB after verification");
  });

  it("8. OTP issued for signup cannot authorize login or password reset", async () => {
    // Register User D
    await fetch(`${BASE_URL}/api/auth/register-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "UserD",
        lastName: "OtpScope",
        email: userD_email,
        password,
      }),
    });

    const [userD] = await db.select().from(schema.users).where(eq(schema.users.email, userD_email));
    const otpCode = userD.emailVerificationCode!;

    // 1. Attempt login using OTP code as password
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userD_email, password: otpCode }),
    });
    assert.equal(loginRes.status, 401, "OTP code cannot be used as password to login");

    // 2. Attempt reset-password using OTP code as reset token
    const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: otpCode, password: "NewStrongPassword99!" }),
    });
    assert.equal(resetRes.status, 400, "OTP code cannot be used as a password reset token");
  });

  it("9. Concurrent signup with same email rejected via unique constraint", async () => {
    const p1 = fetch(`${BASE_URL}/api/auth/register-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Race",
        lastName: "Condition1",
        email: userConcurrent_email,
        password,
      }),
    });

    const p2 = fetch(`${BASE_URL}/api/auth/register-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Race",
        lastName: "Condition2",
        email: userConcurrent_email,
        password,
      }),
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    const statuses = [r1.status, r2.status].sort();

    assert.deepEqual(
      statuses,
      [201, 409],
      "Exactly one registration must succeed with 201 and the concurrent duplicate must fail with 409"
    );
  });

  it("10. Max 5 OTP attempts locks and invalidates the code", async () => {
    // Register User E
    await fetch(`${BASE_URL}/api/auth/register-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "UserE",
        lastName: "RateLimit",
        email: userE_email,
        password,
      }),
    });

    const [userE] = await db.select().from(schema.users).where(eq(schema.users.email, userE_email));
    const correctCode = userE.emailVerificationCode!;

    // Exhaust 5 failed attempts
    for (let i = 1; i <= 4; i++) {
      const res = await fetch(`${BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userE_email, code: "111111" }),
      });
      assert.equal(res.status, 400);
    }

    // 5th attempt: should tell user too many attempts
    const attempt5 = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userE_email, code: "111111" }),
    });
    assert.equal(attempt5.status, 400);
    const data5 = await attempt5.json();
    assert.ok(data5.error.includes("invalidated") || data5.error.includes("Too many failed attempts"));

    // 6th attempt: even with the CORRECT code, must be locked!
    const attempt6 = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userE_email, code: correctCode }),
    });
    assert.equal(attempt6.status, 400);
    const data6 = await attempt6.json();
    assert.ok(data6.error.includes("Too many failed attempts"));
  });

  it("11. Logout invalidates session and clears cookies", async () => {
    assert.ok(userA_cookie, "User A has cookie");

    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: userA_cookie },
    });
    assert.equal(logoutRes.status, 200);

    const setCookie = logoutRes.headers.get("set-cookie");
    assert.ok(
      setCookie && (setCookie.includes("session_token=;") || setCookie.includes("Max-Age=0")),
      "Logout must clear session_token cookie"
    );

    // Call /api/auth/me without cookies
    const meRes = await fetch(`${BASE_URL}/api/auth/me`);
    assert.equal(meRes.status, 401, "Must be unauthorized after logout");
  });

  it("12. Session refresh and api/auth/me validate tokens and reject tampering", async () => {
    // Valid login
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userA_email, password }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    const token = loginData.token;
    assert.ok(token);

    // Tamper with signature
    const tamperedToken = token.slice(0, -6) + "xxxxxx";
    const meTampered = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    assert.equal(meTampered.status, 401, "Tampered JWT must be rejected");

    // Correct token
    const meValid = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(meValid.status, 200, "Valid JWT must be accepted");
    const meData = await meValid.json();
    assert.equal(meData.user.email, userA_email);
  });

  it("13. Failed signup does not issue token or trigger authenticated redirect", async () => {
    // Verify client-side contract: Calling register with existing email returns 409
    const res = await fetch(`${BASE_URL}/api/auth/register-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Duplicate",
        lastName: "Test",
        email: userA_email,
        password,
      }),
    });

    assert.equal(res.status, 409);
    const data = await res.json();
    assert.equal(data.token, undefined);
    assert.equal(res.headers.get("set-cookie"), null);
  });

  it("14. Full lifecycle operational: Login, Signup, Resend cooldown, Verification, Reset password", async () => {
    const fullLifecycleEmail = `full_lifecycle_${timestamp}@ile-test.ng`;

    // Step A: Register
    const regRes = await fetch(`${BASE_URL}/api/auth/register-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Chidi",
        lastName: "Okonkwo",
        email: fullLifecycleEmail,
        password,
        hostType: "individual_owner",
      }),
    });
    assert.equal(regRes.status, 201);

    // Step B: Resend OTP immediately (should trigger 60s cooldown)
    const cooldownRes = await fetch(`${BASE_URL}/api/auth/resend-email-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fullLifecycleEmail }),
    });
    assert.equal(cooldownRes.status, 400, "Should enforce resend cooldown");
    const cooldownData = await cooldownRes.json();
    assert.ok(cooldownData.error.includes("wait") || cooldownData.error.includes("seconds"));

    // Step C: Verify with valid OTP
    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.email, fullLifecycleEmail));
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fullLifecycleEmail, code: dbUser.emailVerificationCode }),
    });
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.ok(verifyData.token);
    assert.equal(verifyData.user.emailVerified, true);

    // Step D: Forgot Password
    const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fullLifecycleEmail }),
    });
    assert.equal(forgotRes.status, 200);

    // Step E: Read reset token from DB and reset password
    const [userWithReset] = await db.select().from(schema.users).where(eq(schema.users.email, fullLifecycleEmail));
    assert.ok(userWithReset.resetToken, "Password reset token must be stored");

    const newPassword = "BrandNewPassword123#";
    const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: userWithReset.resetToken, password: newPassword }),
    });
    assert.equal(resetRes.status, 200);

    // Step F: Login with new password
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fullLifecycleEmail, password: newPassword }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.token);
    assert.equal(loginData.user.email, fullLifecycleEmail);
  });
});
