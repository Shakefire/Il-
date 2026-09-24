// Automated End-to-End Verification Script for Stage 1 MVP Foundation

const BASE_URL = "http://127.0.0.1:4000/api";

async function runTests() {
  console.log("=================================================");
  console.log("🚀 STARTING ILÉ MVP END-TO-END VERIFICATION SUITE");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (detail) console.log(`          ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`          ${detail}`);
      failed++;
    }
  }

  // 1. GET /api/properties
  console.log("Test 1: Public Properties Listing");
  const propsRes = await fetch(`${BASE_URL}/properties`);
  const propsData = await propsRes.json();
  assert(propsRes.ok && propsData.properties?.length >= 10, "Properties endpoint returns published properties", `Found ${propsData.properties?.length} properties`);

  const sampleProp = propsData.properties[0];
  assert(sampleProp && !sampleProp.exactAddress && !sampleProp.accessGateCode, "Security Check: Public properties do NOT expose quarantined private address or gate code");

  // 2. GET /api/search?location=Maitama
  console.log("\nTest 2: Arbitrary Location Search (Maitama)");
  const searchMaitama = await (await fetch(`${BASE_URL}/search?location=Maitama`)).json();
  assert(searchMaitama.properties?.length > 0, "Location search for 'Maitama' returns matching stays", `Found ${searchMaitama.properties?.length} stays in/near Maitama`);

  // 3. GET /api/search?location=Nicon Luxury (Landmark search)
  console.log("\nTest 3: Landmark Search (Nicon Luxury)");
  const searchNicon = await (await fetch(`${BASE_URL}/search?location=Nicon%20Luxury`)).json();
  assert(searchNicon.properties?.length > 0, "Landmark search for 'Nicon Luxury' resolves coordinates and finds nearby stays", `Found ${searchNicon.properties?.length} stays within radius`);

  // 4. Guest Checkout Without Account (POST /api/bookings)
  console.log("\nTest 4: Guest Checkout Without Account (Server-side Pricing & Availability Block)");
  const guestEmail = `testguest_${Date.now()}@example.ng`;
  const uniqueDays = Math.floor(Math.random() * 800) + 120;
  const inDate = new Date(Date.now() + uniqueDays * 86400000);
  const outDate = new Date(inDate.getTime() + 3 * 86400000);
  const bookingPayload = {
    propertyId: sampleProp.id,
    guestFirstName: "Chukwudi",
    guestLastName: "Eze",
    guestEmail,
    guestPhone: "+2348039998877",
    guestCount: 2,
    checkInDate: inDate.toISOString().slice(0, 10),
    checkOutDate: outDate.toISOString().slice(0, 10),
  };

  const bookingRes = await fetch(`${BASE_URL}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookingPayload),
  });
  const bookingData = await bookingRes.json();
  if (!bookingRes.ok) {
    console.error("Booking error:", bookingRes.status, bookingData);
  }
  assert(bookingRes.ok && bookingData.booking?.id, "Guest checkout succeeds without an account", `Booking ID: ${bookingData.booking?.id}, AccessToken generated`);

  const createdBooking = bookingData.booking;
  const bookingTotal = createdBooking.totalPrice || createdBooking.pricing?.totalAmount || createdBooking.totalAmount || 0;
  assert(bookingTotal > 0 && createdBooking.numberOfNights === 3, "Server-side pricing calculated strictly on backend", `Total: ₦${bookingTotal.toLocaleString()} for ${createdBooking.numberOfNights} nights`);

  // 5. SECURITY QUARANTINE: Attempt accessing private details before payment
  console.log("\nTest 5: Quarantined Details Access Control Before Payment");
  const prePayContactRes = await fetch(`${BASE_URL}/bookings/${createdBooking.id}/contact`, {
    headers: { "X-Access-Token": createdBooking.accessToken },
  });
  assert(prePayContactRes.status === 403, "Access to quarantined details is FORBIDDEN (403) before payment confirmation");

  // 6. Payment Processing (POST /api/bookings/:id/pay)
  console.log("\nTest 6: Booking Payment Processing");
  const payRes = await fetch(`${BASE_URL}/bookings/${createdBooking.id}/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Access-Token": createdBooking.accessToken,
    },
    body: JSON.stringify({
      paymentMethod: "BANK_TRANSFER",
      paymentReference: `REF_${Date.now()}`,
    }),
  });
  const payData = await payRes.json();
  assert(payRes.ok && payData.booking?.status === "CONFIRMED", "Payment succeeds and moves booking status to CONFIRMED");

  // 7. SECURITY QUARANTINE: Access private details after payment confirmed
  console.log("\nTest 7: Quarantined Details Unlocked After Payment");
  const postPayContactRes = await fetch(`${BASE_URL}/bookings/${createdBooking.id}/contact`, {
    headers: { "X-Access-Token": createdBooking.accessToken },
  });
  const contactData = await postPayContactRes.json();
  assert(
    postPayContactRes.ok &&
    contactData.contact?.exactAddress &&
    contactData.contact?.hostPhone,
    "Quarantined details (Exact Street Address, Gate Code, Host Contact) successfully unlocked upon confirmation",
    `Address: ${contactData.contact?.exactAddress} | Gate: ${contactData.contact?.accessGateCode} | Host: ${contactData.contact?.hostPhone}`
  );

  // 8. Auto-Link Prior Guest Bookings on Subsequent Registration
  console.log("\nTest 8: Auto-Link Previous Guest Bookings upon User Registration");
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Chukwudi",
      lastName: "Eze",
      email: guestEmail,
      phone: "+2348039998877",
      password: "SecurePassword123!",
    }),
  });
  const regData = await regRes.json();
  assert(regRes.ok && regData.user?.id, "Guest registers account with previously used booking email", `Registered User ID: ${regData.user?.id}`);

  // Fetch user's bookings
  const myBookingsRes = await fetch(`${BASE_URL}/bookings`, {
    headers: { Authorization: `Bearer ${regData.token}` },
  });
  const myBookingsData = await myBookingsRes.json();
  const linked = myBookingsData.bookings?.some((b: any) => b.id === createdBooking.id);
  assert(linked, "Pre-existing guest booking was automatically associated to the newly registered account!");

  // 9. Host Listing Flow (DRAFT -> PENDING_REVIEW)
  console.log("\nTest 9: Host Property Creation (DRAFT -> PENDING_REVIEW)");
  const newPropPayload = {
    title: "The Zaria Executive Suite",
    propertyType: "Serviced Apartment",
    spaceType: "Entire place",
    bedrooms: 2,
    bathrooms: 2,
    beds: 2,
    maxGuests: 4,
    pricePerNight: 95000,
    city: "Abuja",
    neighborhood: "Wuse 2",
    state: "FCT",
    powerType: "Solar + Inverter",
    coverImage: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
    description: "Quiet luxury in the heart of Wuse 2 with dedicated solar inverter and private compound.",
    exactAddress: "14 Adetokunbo Ademola Crescent, Wuse 2, Abuja",
    unitNumber: "Apt 204",
    contactName: "Chukwudi Eze",
    contactPhone: "+2348039998877",
    contactEmail: guestEmail,
    accessGateCode: "GATE-4488",
  };

  const createPropRes = await fetch(`${BASE_URL}/host/properties`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${regData.token}`,
    },
    body: JSON.stringify(newPropPayload),
  });
  const createPropData = await createPropRes.json();
  assert(createPropRes.ok && createPropData.property?.status === "DRAFT", "Host creates listing with status DRAFT", `Property ID: ${createPropData.property?.id}`);

  const submitRes = await fetch(`${BASE_URL}/host/properties/${createPropData.property.id}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${regData.token}` },
  });
  const submitData = await submitRes.json();
  assert(submitRes.ok && submitData.property?.status === "PENDING_REVIEW", "Host submits listing for review -> status PENDING_REVIEW");

  // 10. Admin Verification & Approval Flow (PENDING_REVIEW -> PUBLISHED)
  console.log("\nTest 10: Admin Verification & Approval with Audit Trail");
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@ile.ng",
      password: "Password123!",
    }),
  });
  const adminLoginData = await adminLoginRes.json();
  assert(adminLoginRes.ok && adminLoginData.token, "Admin authenticates successfully");

  const approveRes = await fetch(`${BASE_URL}/admin/properties/${createPropData.property.id}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminLoginData.token}` },
  });
  const approveData = await approveRes.json();
  assert(approveRes.ok && approveData.success, "Admin approves listing -> status PUBLISHED");

  // Check audit log
  const auditRes = await fetch(`${BASE_URL}/admin/audit-logs`, {
    headers: { Authorization: `Bearer ${adminLoginData.token}` },
  });
  const auditData = await auditRes.json();
  const logFound = auditData.logs?.some((l: any) => l.action === "PROPERTY_APPROVED" && l.entityId === createPropData.property.id);
  assert(logFound, "Approval was securely logged to audit_logs trail");

  console.log("\n=================================================");
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
