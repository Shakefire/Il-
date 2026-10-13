import {
  bookingConfirmationEmail,
  BookingConfirmationData,
  bookingAccessPassEmail,
  BookingAccessPassData,
} from "../backend/src/modules/notifications/notifications.service";
import fs from "fs";
import path from "path";

console.log("=== ILÉ BOOKING CONFIRMATION EMAIL VERIFICATION SUITE ===\n");

const outputDir = path.resolve(process.cwd(), "artifacts", "emails");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✕ [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 1: Fully Confirmed Booking (Boutique Stay with Full Details)
// ─────────────────────────────────────────────────────────────────────────────
console.log("Scenario 1: Confirmed luxury reservation in Maitama with full details");
const confirmedData: BookingConfirmationData = {
  guestName: "Zainab Ahmed",
  guestEmail: "zainab.ahmed@example.com",
  guestPhone: "+234 803 555 0192",
  propertyTitle: "The Olive Residence",
  propertyType: "Serviced Apartment",
  spaceType: "Entire place",
  propertyImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
  propertyTagline: "Quiet three-bedroom residence with private terrace and continuous solar power.",
  bedrooms: 3,
  bathrooms: 3,
  beds: 3,
  maxGuests: 5,
  guestCount: 3,
  neighborhood: "Maitama",
  city: "Abuja",
  state: "FCT",
  powerType: "24/7 Solar + Inverter Backup",
  referenceCode: "ILE-MAITAMA-7701",
  checkIn: "2026-11-12",
  checkOut: "2026-11-15",
  numberOfNights: 3,
  nightlyPrice: 85000,
  cleaningFee: 15000,
  serviceFee: 20400,
  totalAmount: 290400,
  amountPaid: 290400,
  outstandingBalance: 0,
  currency: "NGN",
  paymentMethod: "Paystack (Mastercard **** 4242)",
  paymentReference: "PAY_ILE_7701_99182",
  paymentStatus: "SUCCESS",
  paidAt: new Date("2026-10-13T12:00:00Z"),
  bookingStatus: "CONFIRMED",
  accessToken: "token_abc123xyz456",
  address: "Plot 14B, Udi Hill Crescent, Off Yedseram Street, Maitama",
  unitNumber: "Penthouse 3B",
  latitude: 9.0882,
  longitude: 7.4981,
  accessGateCode: "IL-MAIT-8842",
  accessInstructions: "Security will clear your vehicle upon mentioning reservation ref ILE-MAITAMA-7701. Proceed to Gate B elevator.",
  houseRules: "Strict quiet hours from 10 PM. No unauthorized photo shoots.",
  checkInTime: "From 3:00 PM (15:00)",
  checkOutTime: "By 11:00 AM (11:00)",
  hostName: "Amina Bello",
  hostPhone: "+234 912 202 9904",
  hostEmail: "amina.host@ile.ng",
};

const result1 = bookingConfirmationEmail(confirmedData);
fs.writeFileSync(path.join(outputDir, "01_confirmed_reservation.html"), result1.html);
fs.writeFileSync(path.join(outputDir, "01_confirmed_reservation.txt"), result1.text || "");

assert(result1.to === "zainab.ahmed@example.com", "Recipient email matches");
assert(result1.subject.includes("Booking Confirmed: The Olive Residence (ILE-MAITAMA-7701)"), "Subject indicates confirmed booking");
assert(result1.html.includes("The Olive Residence"), "HTML contains property title");
assert(result1.html.includes("CONFIRMED"), "HTML includes confirmed status badge");
assert(result1.html.includes("ILE-MAITAMA-7701"), "HTML includes reference code");
assert(result1.html.includes("Zainab Ahmed"), "HTML includes guest name");
assert(result1.html.includes("₦290,400"), "HTML includes total formatted amount in Naira");
assert(result1.html.includes("₦255,000"), "HTML includes calculated subtotal (85k x 3)");
assert(result1.html.includes("₦15,000"), "HTML includes cleaning fee");
assert(result1.html.includes("₦20,400"), "HTML includes service fee");
assert(result1.html.includes("Settled in Full"), "HTML indicates settled balance");
assert(result1.html.includes("IL-MAIT-8842"), "HTML includes gate clearance code");
assert(result1.html.includes("Plot 14B, Udi Hill Crescent"), "HTML includes unlocked physical address");
assert(result1.html.includes("Penthouse 3B"), "HTML includes unit number");
assert(result1.html.includes("Amina Bello"), "HTML includes host name");
assert(result1.html.includes("24/7 Solar + Inverter"), "HTML includes power infrastructure badge");
assert(result1.html.includes("3 Bedroom"), "HTML includes bedroom count");
assert(result1.html.includes("images.unsplash.com"), "HTML includes hero image URL");
assert((result1.text || "").includes("ILÉ — VERIFIED NIGERIAN SHORTLETS"), "Plain text contains header");
assert((result1.text || "").includes("IL-MAIT-8842"), "Plain text contains gate pass");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 2: Pending Payment Booking (Awaiting settlement)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nScenario 2: Pending payment reservation");
const pendingData: BookingConfirmationData = {
  guestName: "Chinedu Okafor",
  guestEmail: "chinedu@example.ng",
  propertyTitle: "The Palm Lekki",
  referenceCode: "ILE-LEKKI-4412",
  checkIn: "2026-12-01",
  checkOut: "2026-12-05",
  totalAmount: 420000,
  amountPaid: 0,
  outstandingBalance: 420000,
  currency: "NGN",
  bookingStatus: "PAYMENT_PENDING",
  address: "Admiralty Way, Lekki Phase 1",
  accessGateCode: "SECRET-GATE-99",
};

const result2 = bookingConfirmationEmail(pendingData);
fs.writeFileSync(path.join(outputDir, "02_pending_reservation.html"), result2.html);

assert(result2.subject.includes("Payment Pending"), "Subject indicates payment pending");
assert(result2.html.includes("PAYMENT PENDING"), "HTML status badge shows PAYMENT PENDING");
assert(result2.html.includes("Reservation received — awaiting payment"), "HTML headline is tailored for pending state");
assert(result2.html.includes("₦420,000"), "HTML shows outstanding total");
assert(!result2.html.includes("SECRET-GATE-99"), "Private gate code is QUARANTINED while pending");
assert(!result2.html.includes("Admiralty Way, Lekki"), "Physical street address is QUARANTINED while pending");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 3: Partially Paid Booking (Deposit paid, balance remaining)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nScenario 3: Partially paid reservation (deposit model)");
const partialData: BookingConfirmationData = {
  guestName: "Folake Balogun",
  guestEmail: "folake@example.com",
  propertyTitle: "Victoria Island Executive Studio",
  referenceCode: "ILE-VI-9021",
  checkIn: "2026-11-20",
  checkOut: "2026-11-22",
  numberOfNights: 2,
  nightlyPrice: 70000,
  cleaningFee: 10000,
  serviceFee: 11200,
  totalAmount: 161200,
  amountPaid: 80000,
  outstandingBalance: 81200,
  currency: "NGN",
  bookingStatus: "PENDING",
  paymentMethod: "Bank Transfer (Zenith Bank)",
  paymentReference: "TRF_99812_DEP",
};

const result3 = bookingConfirmationEmail(partialData);
fs.writeFileSync(path.join(outputDir, "03_partial_payment.html"), result3.html);

assert(result3.html.includes("₦161,200"), "HTML shows total cost");
assert(result3.html.includes("₦80,000"), "HTML shows amount paid");
assert(result3.html.includes("₦81,200"), "HTML highlights outstanding balance due");
assert(result3.html.includes("Outstanding Balance Due"), "HTML displays balance warning label");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 4: Cancelled Reservation
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nScenario 4: Cancelled reservation");
const cancelledData: BookingConfirmationData = {
  guestName: "Ibrahim Musa",
  guestEmail: "ibrahim@example.ng",
  propertyTitle: "Asokoro Diplomatic Villa",
  referenceCode: "ILE-ASOK-1102",
  checkIn: "2026-11-10",
  checkOut: "2026-11-14",
  totalAmount: 500000,
  bookingStatus: "CANCELLED",
};

const result4 = bookingConfirmationEmail(cancelledData);
fs.writeFileSync(path.join(outputDir, "04_cancelled_reservation.html"), result4.html);

assert(result4.subject.includes("Reservation Cancelled"), "Subject indicates cancellation");
assert(result4.html.includes("CANCELLED"), "HTML status badge shows CANCELLED");
assert(result4.html.includes("Your reservation has been cancelled"), "HTML headline announces cancellation");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 5: Missing Cover Image (Graceful Omission)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nScenario 5: Missing cover image (graceful fallback without broken img)");
const noImageData: BookingConfirmationData = {
  guestName: "Kemi Adeleke",
  guestEmail: "kemi@example.com",
  propertyTitle: "Guzape View Suites",
  referenceCode: "ILE-GUZ-3301",
  checkIn: "2026-12-10",
  checkOut: "2026-12-12",
  totalAmount: 180000,
  propertyImage: undefined, // no image
  bookingStatus: "CONFIRMED",
};

const result5 = bookingConfirmationEmail(noImageData);
fs.writeFileSync(path.join(outputDir, "05_missing_image.html"), result5.html);

assert(!result5.html.includes("<img class=\"hero-img\""), "No broken hero img tag rendered when image is missing");
assert(result5.html.includes("Guzape View Suites"), "Property title is rendered cleanly");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 6: Multi-Currency Support (USD, EUR)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nScenario 6: Multi-currency support (USD, EUR)");
const usdData: BookingConfirmationData = {
  guestName: "Marcus Sterling",
  guestEmail: "marcus@international.com",
  propertyTitle: "Eko Atlantic Horizon Tower",
  referenceCode: "ILE-EKO-USD-1",
  checkIn: "2026-11-05",
  checkOut: "2026-11-10",
  totalAmount: 2500,
  currency: "USD",
  bookingStatus: "CONFIRMED",
};

const resultUsd = bookingConfirmationEmail(usdData);
assert(resultUsd.html.includes("$2,500"), "USD currency formatted with $ symbol");
assert(resultUsd.html.includes("Currency: USD"), "Currency code indicated as USD");

const eurData: BookingConfirmationData = {
  guestName: "Jean-Pierre Laurent",
  guestEmail: "jp@paris.fr",
  propertyTitle: "Ikoyi Residence",
  referenceCode: "ILE-IKY-EUR-2",
  checkIn: "2026-11-15",
  checkOut: "2026-11-18",
  totalAmount: 1800,
  currency: "EUR",
  bookingStatus: "CONFIRMED",
};

const resultEur = bookingConfirmationEmail(eurData);
assert(resultEur.html.includes("€1,800"), "EUR currency formatted with € symbol");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 7: XSS & HTML Injection Protection
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nScenario 7: Untrusted input safety and HTML escaping");
const xssData: BookingConfirmationData = {
  guestName: "<script>alert('xss')</script>John Doe",
  guestEmail: "attacker@test.com",
  propertyTitle: "Lekki \"Suites\" & Co <b onmouseover=alert(1)>Luxury</b>",
  referenceCode: "ILE-XSS-<test>",
  checkIn: "2026-11-01",
  checkOut: "2026-11-03",
  totalAmount: 100000,
  address: "123 Test St <img src=x onerror=alert(2)>",
  unitNumber: "1A <script>",
  accessGateCode: "CODE&<B>",
  accessInstructions: "Instructions with & and <tags>",
};

const resultXss = bookingConfirmationEmail(xssData);
assert(!resultXss.html.includes("<script>alert('xss')</script>"), "Raw script tag is not present");
assert(resultXss.html.includes("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"), "Script tag in guestName is safely escaped");
assert(resultXss.html.includes("&quot;Suites&quot; &amp; Co"), "Quotes and ampersands in title are escaped");
assert(!resultXss.html.includes("<img src=x onerror=alert(2)>"), "Img onerror injection in address is prevented");
assert(resultXss.html.includes("&lt;img src=x onerror=alert(2)&gt;"), "Img tag in address is safely escaped");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 8: Separate Payer vs Lead Guest
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nScenario 8: Separate payer vs lead guest distinction");
const payerData: BookingConfirmationData = {
  guestName: "Dr. Amaka Eze",
  guestEmail: "amaka.eze@hospital.ng",
  guestPhone: "+234 802 111 2233",
  payerName: "Eze Global Logistics Ltd (Chief Emeka Eze)",
  payerEmail: "finance@ezeglobal.ng",
  payerPhone: "+234 809 999 8888",
  propertyTitle: "Maitama Heights",
  referenceCode: "ILE-CORP-5501",
  checkIn: "2026-11-10",
  checkOut: "2026-11-12",
  totalAmount: 300000,
  bookingStatus: "CONFIRMED",
};

const resultPayer = bookingConfirmationEmail(payerData);
fs.writeFileSync(path.join(outputDir, "08_separate_payer.html"), resultPayer.html);

assert(resultPayer.html.includes("Dr. Amaka Eze"), "Lead guest name is displayed");
assert(resultPayer.html.includes("Billing / Payer Record"), "Payer record header is displayed");
assert(resultPayer.html.includes("Eze Global Logistics Ltd"), "Separate payer name is displayed");
assert(resultPayer.html.includes("finance@ezeglobal.ng"), "Separate payer email is displayed");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 9: Legacy Minimal Call (Backwards Compatibility)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nScenario 9: Legacy minimal call (backwards compatibility)");
const legacyData = {
  guestName: "Ada Lovelace",
  guestEmail: "ada@example.com",
  propertyTitle: "Classic Flat Lekki",
  referenceCode: "ILE-LEGACY-001",
  checkIn: "2026-11-01",
  checkOut: "2026-11-04",
  totalAmount: 150000,
};

const resultLegacy = bookingConfirmationEmail(legacyData);
assert(resultLegacy.to === "ada@example.com", "Legacy call delivered to correct email");
assert(resultLegacy.subject.includes("Booking Confirmed: Classic Flat Lekki"), "Legacy call generated subject");
assert(resultLegacy.html.includes("Classic Flat Lekki"), "Legacy call rendered property title");
assert(resultLegacy.html.includes("3 Nights"), "Legacy call calculated 3 nights from dates");
assert(resultLegacy.html.includes("₦150,000"), "Legacy call formatted total amount");
assert(resultLegacy.html.includes("CONFIRMED"), "Legacy call defaulted to confirmed status");

// ═════════════════════════════════════════════════════════════════════════════
// POST-RESERVATION ARRIVAL GUIDE & HOST CONTACT EMAIL (bookingAccessPassEmail)
// ═════════════════════════════════════════════════════════════════════════════
console.log("\n=== POST-RESERVATION ARRIVAL GUIDE & HOST CONTACT SUITE ===\n");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario A: Full Luxury Arrival Guide in Maitama with Host Photo & Details
// ─────────────────────────────────────────────────────────────────────────────
console.log("Scenario A: Complete luxury arrival guide with host avatar, directions, and gate pass");
const arrivalDataFull: BookingAccessPassData = {
  guestName: "Zainab Ahmed",
  guestEmail: "zainab.ahmed@example.com",
  propertyTitle: "The Olive Residence",
  propertyType: "Serviced Apartment",
  spaceType: "Entire place",
  propertyImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
  propertyTagline: "Quiet three-bedroom residence with private terrace and continuous solar power.",
  bedrooms: 3,
  bathrooms: 3,
  guestCount: 3,
  numberOfNights: 3,
  neighborhood: "Maitama",
  city: "Abuja",
  state: "FCT",
  referenceCode: "ILE-MAITAMA-7701",
  checkIn: "2026-11-12",
  checkOut: "2026-11-15",
  checkInTime: "From 3:00 PM (15:00)",
  checkOutTime: "By 11:00 AM (11:00)",
  timeZone: "West Africa Time (WAT / UTC+1)",
  address: "Plot 14B, Udi Hill Crescent, Off Yedseram Street, Maitama",
  unitNumber: "Penthouse 3B",
  latitude: 9.0882,
  longitude: 7.4981,
  accessGateCode: "IL-MAIT-8842",
  accessInstructions: "Security will clear your vehicle upon mentioning reservation ref ILE-MAITAMA-7701. Proceed to Gate B elevator where host will meet you.",
  hostName: "Amina Bello",
  hostPhone: "+234 912 202 9904",
  hostEmail: "amina.host@ile.ng",
  hostAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
  hostRole: "Your accommodation host & arrival concierge",
  parkingDescription: "Dedicated covered parking bay for two vehicles inside the gate.",
  powerDescription: "Continuous 24/7 backup power with 15kVA solar inverter and silent standby generator.",
  securityDescription: "Gated residential compound with 24-hour uniformed guards and CCTV.",
  houseRules: "Strict quiet hours from 10:00 PM. No unregistered gatherings.",
  accessToken: "token_abc123xyz456",
};

const resultArrivalFull = bookingAccessPassEmail(arrivalDataFull);
fs.writeFileSync(path.join(outputDir, "10_arrival_guide_full.html"), resultArrivalFull.html);
fs.writeFileSync(path.join(outputDir, "10_arrival_guide_full.txt"), resultArrivalFull.text || "");

assert(resultArrivalFull.to === "zainab.ahmed@example.com", "Arrival guide recipient matches");
assert(resultArrivalFull.subject.includes("Arrival Guide & Stay Details: The Olive Residence (ILE-MAITAMA-7701)"), "Arrival guide subject formatted");
assert(resultArrivalFull.html.includes("Here&rsquo;s where you&rsquo;re staying and how to reach your host."), "Arrival guide warm headline present");
assert(resultArrivalFull.html.includes("Zainab Ahmed"), "Arrival guide guest greeting personalized");
assert(resultArrivalFull.html.includes("The Olive Residence"), "Arrival guide contains property name");
assert(resultArrivalFull.html.includes("Plot 14B, Udi Hill Crescent"), "Selectable address text included");
assert(resultArrivalFull.html.includes("Penthouse 3B"), "Unit details included");
assert(resultArrivalFull.html.includes("Get Directions on Google Maps"), "Directions CTA button present");
assert(resultArrivalFull.html.includes("https://www.google.com/maps/search/?api=1&query=9.0882,7.4981"), "Maps query built with coordinates");
assert(resultArrivalFull.html.includes("Amina Bello"), "Host display name included");
assert(resultArrivalFull.html.includes("Your accommodation host &amp; arrival concierge"), "Host role label included");
assert(resultArrivalFull.html.includes("+234 912 202 9904"), "Host telephone link included");
assert(resultArrivalFull.html.includes("amina.host@ile.ng"), "Host clickable mail link included");
assert(resultArrivalFull.html.includes("images.unsplash.com/photo-1534528741775"), "Host avatar image included");
assert(resultArrivalFull.html.includes("Message Host on WhatsApp"), "WhatsApp chat action present");
assert(resultArrivalFull.html.includes("IL-MAIT-8842"), "Estate gate pass code displayed in box");
assert(resultArrivalFull.html.includes("West Africa Time (WAT / UTC+1)"), "Time zone displayed clearly");
assert(resultArrivalFull.html.includes("3 Nights"), "Stay length formatted");
assert(resultArrivalFull.html.includes("Dedicated covered parking bay"), "Parking description included");
assert(resultArrivalFull.html.includes("Continuous 24/7 backup power"), "Power description included");
assert((resultArrivalFull.text || "").includes("EXACT APARTMENT ADDRESS:"), "Plain text contains address section");
assert((resultArrivalFull.text || "").includes("IL-MAIT-8842"), "Plain text contains gate code");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario B: Missing Host Photo (Neutral Monogram Circle Fallback)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nScenario B: Missing host photo (monogram circle fallback)");
const arrivalNoPhoto: BookingAccessPassData = {
  guestName: "Emeka Okonkwo",
  guestEmail: "emeka@test.ng",
  propertyTitle: "Ikoyi Bay Apartment",
  referenceCode: "ILE-IKY-5502",
  checkIn: "2026-11-20",
  checkOut: "2026-11-23",
  address: "Bourdillon Road, Ikoyi, Lagos",
  hostName: "Babajide Davies",
  hostPhone: "+234 802 000 1122",
  hostAvatar: undefined, // no photo
};

const resultNoPhoto = bookingAccessPassEmail(arrivalNoPhoto);
fs.writeFileSync(path.join(outputDir, "11_arrival_guide_no_avatar.html"), resultNoPhoto.html);

assert(!resultNoPhoto.html.includes("<img src=\"\""), "No empty img tag rendered for missing avatar");
assert(resultNoPhoto.html.includes("BD"), "Monogram circle rendered with host initials 'BD'");
assert(resultNoPhoto.html.includes("Babajide Davies"), "Host name rendered cleanly");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario C: Missing Property Image (Graceful Omission)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nScenario C: Missing property image in arrival guide");
const arrivalNoCover: BookingAccessPassData = {
  guestName: "Hauwa Garba",
  guestEmail: "hauwa@kano.ng",
  propertyTitle: "Central Business District Executive Flat",
  referenceCode: "ILE-CBD-8811",
  checkIn: "2026-12-05",
  checkOut: "2026-12-08",
  address: "Constitution Avenue, CBD, Abuja",
  propertyImage: undefined, // no image
};

const resultNoCover = bookingAccessPassEmail(arrivalNoCover);
fs.writeFileSync(path.join(outputDir, "12_arrival_guide_no_image.html"), resultNoCover.html);

assert(!resultNoCover.html.includes("<img class=\"hero-img\""), "Hero img omitted when cover image missing");
assert(resultNoCover.html.includes("Central Business District Executive Flat"), "Property title rendered cleanly");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario D: XSS & Untrusted Input Escaping
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nScenario D: XSS & untrusted content escaping in arrival guide");
const arrivalXss: BookingAccessPassData = {
  guestName: "Attacker <script>alert(1)</script>",
  guestEmail: "guest@security.org",
  propertyTitle: "The \"Grand\" <b onmouseover=evil()>Lekki</b> Residence",
  referenceCode: "ILE-SEC-<404>",
  checkIn: "2026-11-01",
  checkOut: "2026-11-03",
  address: "42 Marina <img src=x onerror=alert(2)>",
  unitNumber: "Flat 2B & <script>",
  accessGateCode: "GATE&<CODE>",
  accessInstructions: "Instructions with <script> and & symbol",
  hostName: "Host <img src=1>",
  houseRules: "Rules with <iframe src='evil.com'>",
};

const resultArrivalXss = bookingAccessPassEmail(arrivalXss);
assert(!resultArrivalXss.html.includes("<script>alert(1)</script>"), "Script tag in guestName prevented");
assert(resultArrivalXss.html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "GuestName safely escaped");
assert(!resultArrivalXss.html.includes("<img src=x onerror=alert(2)>"), "Img onerror injection in address prevented");
assert(resultArrivalXss.html.includes("&lt;img src=x onerror=alert(2)&gt;"), "Address tag safely escaped");
assert(!resultArrivalXss.html.includes("<iframe src='evil.com'>"), "Iframe in house rules prevented");

// ─────────────────────────────────────────────────────────────────────────────
// Scenario E: Legacy Minimal Call Backwards Compatibility
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nScenario E: Legacy minimal call backwards compatibility for arrival guide");
const legacyArrival = {
  guestName: "Tunde Bakare",
  guestEmail: "tunde@example.com",
  propertyTitle: "Sunset Terrace Wuse 2",
  referenceCode: "ILE-WUSE-901",
  checkIn: "2026-11-15",
  checkOut: "2026-11-18",
  address: "Adetokunbo Ademola Crescent, Wuse 2, Abuja",
  accessInstructions: "Ask security for Mr. Tunde's key at gate.",
};

const resultLegacyArrival = bookingAccessPassEmail(legacyArrival);
assert(resultLegacyArrival.to === "tunde@example.com", "Legacy arrival guide delivered to correct email");
assert(resultLegacyArrival.html.includes("Sunset Terrace Wuse 2"), "Legacy arrival guide rendered property title");
assert(resultLegacyArrival.html.includes("Adetokunbo Ademola Crescent"), "Legacy arrival guide rendered address");
assert(resultLegacyArrival.html.includes("Ask security for Mr. Tunde&#39;s key at gate."), "Legacy instructions rendered");
assert(resultLegacyArrival.html.includes("GATE-CLEARED"), "Default gate pass code used when omitted");

console.log(`\n=============================================================`);
console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests} tests successful.`);
console.log(`Inspection artifacts written to: ${outputDir}`);
console.log(`=============================================================\n`);
