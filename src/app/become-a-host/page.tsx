"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Building2,
  MapPin,
  Users,
  Bed,
  Bath,
  Check,
  Upload,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Plus,
  Minus,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import LocationAutocomplete, { SelectedLocation } from "@/components/LocationAutocomplete";

const PROPERTY_TYPES = [
  "Apartment",
  "House",
  "Villa",
  "Serviced Apartment",
  "Studio",
  "Hotel",
  "Guest House",
];

const SPACE_TYPES = ["Entire place", "Private room", "Shared room"];

const AVAILABLE_AMENITIES = [
  "24/7 Solar + Inverter Power",
  "Dedicated Transformer",
  "High-Speed Fiber Internet",
  "Air Conditioning",
  "Gated Estate Security",
  "Uniformed Guards",
  "Smart Lock / Keyless Entry",
  "Swimming Pool",
  "Fully Equipped Kitchen",
  "Dedicated Workspace",
  "Washing Machine",
  "Free On-Premises Parking",
  "Daily Housekeeping",
  "Smart TV with Netflix",
  "Water Treatment Plant",
];

export default function BecomeAHostPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();

  const [step, setStep] = useState(0); // 0 = welcome, 1-7 = wizard steps
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [propertyType, setPropertyType] = useState("Apartment");
  const [spaceType, setSpaceType] = useState("Entire place");

  // Location State
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [exactAddress, setExactAddress] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [accessGateCode, setAccessGateCode] = useState("");
  const [checkInInstructions, setCheckInInstructions] = useState("");

  // Space Details State
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [beds, setBeds] = useState(1);
  const [maxGuests, setMaxGuests] = useState(2);

  // Amenities
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    "24/7 Solar + Inverter Power",
    "High-Speed Fiber Internet",
    "Air Conditioning",
    "Gated Estate Security",
  ]);

  // Photos
  const [images, setImages] = useState<string[]>([
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80",
  ]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Pricing & Infrastructure
  const [pricePerNight, setPricePerNight] = useState(45000);
  const [powerType, setPowerType] = useState("Solar + Inverter with Generator Backup");
  const [powerDescription, setPowerDescription] = useState(
    "Continuous 24/7 power supply with automatic inverter switchover during grid cuts."
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login?next=/become-a-host");
    }
  }, [isLoading, isAuthenticated, router]);

  // Auto-save draft when moving between steps
  const saveDraft = async (): Promise<string | null> => {
    setIsSaving(true);
    setSaveError(null);

    const draftData = {
      title: title || "Untitled Listing",
      tagline: tagline || undefined,
      description: description || "Draft listing in progress.",
      propertyType,
      spaceType,
      city: selectedLocation?.city || "Abuja",
      neighborhood: selectedLocation?.neighborhood || "Central Area",
      state: selectedLocation?.state || "FCT",
      latitude: selectedLocation?.latitude || 9.0765,
      longitude: selectedLocation?.longitude || 7.3986,
      exactAddress: exactAddress || "To be confirmed",
      unitNumber: unitNumber || undefined,
      accessGateCode: accessGateCode || undefined,
      checkInInstructions: checkInInstructions || undefined,
      bedrooms,
      bathrooms,
      beds,
      maxGuests,
      amenities: selectedAmenities,
      images,
      coverImage: images[0] || "/images/placeholder-property.jpg",
      pricePerNight,
      powerType,
      powerDescription,
    };

    try {
      if (!propertyId) {
        // Create initial draft
        const res = await fetch("/api/host/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draftData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save draft.");
        setPropertyId(data.id);
        await refreshUser(); // upgrades user role to host if needed
        return data.id;
      } else {
        // Update existing draft
        const res = await fetch(`/api/host/properties/${propertyId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(draftData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update draft.");
        return propertyId;
      }
    } catch (err: any) {
      setSaveError(err.message || "Failed to save draft.");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextStep = async () => {
    await saveDraft();
    setStep((s) => s + 1);
  };

  const handlePrevStep = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  const toggleAmenity = (name: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setSaveError(null);

    const file = files[0];
    const reader = new FileReader();

    reader.onloadend = async () => {
      try {
        const base64Data = reader.result as string;
        const res = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            image: base64Data,
            mimeType: file.type,
            propertyId: propertyId || undefined,
            folder: "properties",
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed.");

        if (data.url) {
          setImages((prev) => [...prev, data.url]);
        }
      } catch (err: any) {
        setSaveError(err.message || "Failed to upload image.");
      } finally {
        setUploadingImage(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const removeImage = async (idx: number) => {
    const targetUrl = images[idx];
    setImages((prev) => prev.filter((_, i) => i !== idx));

    try {
      if (targetUrl.includes("key=")) {
        const urlObj = new URL(targetUrl, window.location.origin);
        const storageKey = urlObj.searchParams.get("key");
        if (storageKey) {
          await fetch("/api/uploads", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              storageKey,
              propertyId: propertyId || undefined,
            }),
          });
        }
      }
    } catch {
      // Non-blocking cleanup
    }
  };

  const handleSubmitForReview = async () => {
    setMissingFields([]);
    setSaveError(null);
    setIsSaving(true);

    try {
      const activeId = propertyId || (await saveDraft());
      if (!activeId) throw new Error("Please save property details first.");

      const res = await fetch(`/api/host/properties/${activeId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.missingFields && Array.isArray(data.missingFields)) {
          setMissingFields(data.missingFields);
        }
        throw new Error(data.error || "Submission failed. Please complete all required sections.");
      }

      setIsSubmitted(true);
      await refreshUser();
    } catch (err: any) {
      setSaveError(err.message || "Unable to submit property for review.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#FAFAF8]">
        <div className="w-8 h-8 rounded-full border-2 border-[#0B5D45] border-t-transparent animate-spin" />
      </div>
    );
  }

  // ─── Welcome / Get Started Screen (Step 0) ─────────────────────────────────
  if (step === 0) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDF3F0] text-[#0B5D45] text-xs font-semibold uppercase tracking-wider">
              <Sparkles size={14} />
              <span>Host Onboarding</span>
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-[#171717] tracking-tight">
              List your property on Ilé.
            </h1>
            <p className="text-base sm:text-lg text-[#6B6B67] max-w-xl mx-auto leading-relaxed">
              Reach verified business professionals and leisure travelers looking for quality shortlets across Nigeria.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white border border-[#E7E5E0] rounded-2xl p-6 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center font-bold">
                1
              </div>
              <h3 className="font-bold text-[#171717]">Curated Audience</h3>
              <p className="text-xs text-[#6B6B67] leading-relaxed">
                Connect with corporate travelers and international guests who value peaceful spaces.
              </p>
            </div>

            <div className="bg-white border border-[#E7E5E0] rounded-2xl p-6 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center font-bold">
                2
              </div>
              <h3 className="font-bold text-[#171717]">Guaranteed Payouts</h3>
              <p className="text-xs text-[#6B6B67] leading-relaxed">
                Secure payouts via Paystack directly to your Nigerian bank account with full ledger tracking.
              </p>
            </div>

            <div className="bg-white border border-[#E7E5E0] rounded-2xl p-6 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center font-bold">
                3
              </div>
              <h3 className="font-bold text-[#171717]">Location Privacy</h3>
              <p className="text-xs text-[#6B6B67] leading-relaxed">
                Your exact gate code and street address remain quarantined until reservation payment is verified.
              </p>
            </div>
          </div>

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#0B5D45] text-white hover:bg-[#084936] text-[15px] font-semibold transition-all shadow-md hover:shadow-lg"
            >
              <span>Get started</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Post-Submission Success Screen ─────────────────────────────────────────
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] py-16 px-4 flex items-center justify-center">
        <div className="bg-white border border-[#E7E5E0] rounded-2xl max-w-md w-full p-8 text-center space-y-5 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-bold font-display text-[#171717]">
            Listing Submitted for Review!
          </h2>
          <p className="text-sm text-[#6B6B67] leading-relaxed">
            Your listing &ldquo;{title}&rdquo; is now in <strong>PENDING_REVIEW</strong>. Our team reviews submissions to verify continuous power, security, and accuracy before publishing.
          </p>
          <div className="pt-3 flex flex-col gap-2.5">
            <Link
              href="/host/dashboard"
              className="w-full py-3 rounded-xl bg-[#0B5D45] text-white hover:bg-[#084936] text-sm font-semibold transition-colors shadow-sm text-center"
            >
              Go to Host Dashboard
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 rounded-xl border border-[#E7E5E0] text-sm font-medium text-[#6B6B67] hover:text-[#171717] transition-colors text-center"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Multi-Step Wizard Flow (Steps 1 to 7) ───────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAFAF8] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Progress Header */}
        <div className="bg-white border border-[#E7E5E0] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[#8B8B86]">
            <span>STEP {step} OF 7</span>
            {isSaving ? (
              <span className="text-[#0B5D45] flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Saving draft...
              </span>
            ) : propertyId ? (
              <span className="text-emerald-700">Draft saved</span>
            ) : null}
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-[#F0EFEB] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0B5D45] transition-all duration-300 rounded-full"
              style={{ width: `${(step / 7) * 100}%` }}
            />
          </div>
        </div>

        {/* Error Notification */}
        {saveError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{saveError}</p>
              {missingFields.length > 0 && (
                <ul className="list-disc list-inside text-xs space-y-0.5 text-red-600">
                  {missingFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Step Contents */}
        <div className="bg-white border border-[#E7E5E0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* ── STEP 1: Property Basics ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-[#171717]">Property Basics</h2>
                <p className="text-sm text-[#6B6B67] mt-0.5">
                  Give your property a catchy headline and specify what category best represents it.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1.5">
                    Property Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., The Cedar Loft in Wuse 2"
                    className="w-full px-4 py-3 rounded-xl border border-[#E7E5E0] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0B5D45]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1.5">
                    Short Tagline
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g., Sunlit terrace flat with fiber internet & 24/7 power"
                    className="w-full px-4 py-3 rounded-xl border border-[#E7E5E0] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0B5D45]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1.5">
                      Property Type *
                    </label>
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-[#E7E5E0] bg-white text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0B5D45]"
                    >
                      {PROPERTY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1.5">
                      Space Type *
                    </label>
                    <select
                      value={spaceType}
                      onChange={(e) => setSpaceType(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-[#E7E5E0] bg-white text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0B5D45]"
                    >
                      {SPACE_TYPES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1.5">
                    Description *
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the peaceful neighborhood, natural lighting, work environment, and general feel of the space..."
                    className="w-full px-4 py-3 rounded-xl border border-[#E7E5E0] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0B5D45]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Real Location & Exact Address ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-[#171717]">Location &amp; Address</h2>
                <p className="text-sm text-[#6B6B67] mt-0.5">
                  Search your landmark or neighborhood. The public listing will only display general neighborhood proximity.
                </p>
              </div>

              <div className="space-y-4">
                {/* Real Geocoding Search */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1.5">
                    Neighborhood / Landmark Search * (OpenStreetMap)
                  </label>
                  <LocationAutocomplete
                    placeholder="e.g. Maitama, Wuse 2, Nicon Luxury, Lekki..."
                    initialValue={selectedLocation?.name || ""}
                    onSelect={(loc) => setSelectedLocation(loc)}
                  />
                  {selectedLocation && (
                    <div className="mt-2 p-3 bg-[#EDF3F0] rounded-xl text-xs text-[#0B5D45] flex items-center gap-2">
                      <CheckCircle2 size={16} className="shrink-0" />
                      <span>
                        Resolved: <strong>{selectedLocation.name}</strong> ({selectedLocation.city}, {selectedLocation.state}) · Lat: {selectedLocation.latitude.toFixed(4)}, Lng: {selectedLocation.longitude.toFixed(4)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#F2F0EB] pt-3">
                  <h3 className="text-sm font-bold text-[#171717] mb-1">
                    Private Property Details (Quarantined)
                  </h3>
                  <p className="text-xs text-[#8B8B86] mb-3">
                    Only shared with confirmed guests after payment verification.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1">
                        Exact Street Address *
                      </label>
                      <input
                        type="text"
                        value={exactAddress}
                        onChange={(e) => setExactAddress(e.target.value)}
                        placeholder="e.g. Plot 412, Crescent Court, Off Ahmadu Bello Way"
                        className="w-full px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5D45]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1">
                          Unit / Flat Number
                        </label>
                        <input
                          type="text"
                          value={unitNumber}
                          onChange={(e) => setUnitNumber(e.target.value)}
                          placeholder="e.g. Apt 3B"
                          className="w-full px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5D45]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1">
                          Estate Gate Code / Access Pass
                        </label>
                        <input
                          type="text"
                          value={accessGateCode}
                          onChange={(e) => setAccessGateCode(e.target.value)}
                          placeholder="e.g. GATE-7740"
                          className="w-full px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5D45]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1">
                        Arrival &amp; Check-In Instructions
                      </label>
                      <textarea
                        rows={2}
                        value={checkInInstructions}
                        onChange={(e) => setCheckInInstructions(e.target.value)}
                        placeholder="e.g. Show confirmation QR at estate gate. The building manager will hand over keys."
                        className="w-full px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5D45]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Space Details ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[#171717]">Space Details</h2>
                <p className="text-sm text-[#6B6B67] mt-0.5">
                  Set the capacity and bedroom distribution for your guests.
                </p>
              </div>

              <div className="divide-y divide-[#F2F0EB]">
                {/* Max Guests */}
                <div className="py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[#171717]">Maximum Guests</h3>
                    <p className="text-xs text-[#6B6B67]">Maximum guest count accommodated</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setMaxGuests((g) => Math.max(1, g - 1))}
                      className="w-9 h-9 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] flex items-center justify-center font-bold text-base hover:bg-neutral-100"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="w-6 text-center font-bold text-base">{maxGuests}</span>
                    <button
                      type="button"
                      onClick={() => setMaxGuests((g) => Math.min(20, g + 1))}
                      className="w-9 h-9 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] flex items-center justify-center font-bold text-base hover:bg-neutral-100"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Bedrooms */}
                <div className="py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[#171717]">Bedrooms</h3>
                    <p className="text-xs text-[#6B6B67]">Number of private bedrooms</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setBedrooms((b) => Math.max(1, b - 1))}
                      className="w-9 h-9 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] flex items-center justify-center font-bold text-base hover:bg-neutral-100"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="w-6 text-center font-bold text-base">{bedrooms}</span>
                    <button
                      type="button"
                      onClick={() => setBedrooms((b) => Math.min(10, b + 1))}
                      className="w-9 h-9 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] flex items-center justify-center font-bold text-base hover:bg-neutral-100"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Beds */}
                <div className="py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[#171717]">Beds</h3>
                    <p className="text-xs text-[#6B6B67]">Total beds available</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setBeds((b) => Math.max(1, b - 1))}
                      className="w-9 h-9 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] flex items-center justify-center font-bold text-base hover:bg-neutral-100"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="w-6 text-center font-bold text-base">{beds}</span>
                    <button
                      type="button"
                      onClick={() => setBeds((b) => Math.min(15, b + 1))}
                      className="w-9 h-9 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] flex items-center justify-center font-bold text-base hover:bg-neutral-100"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Bathrooms */}
                <div className="py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[#171717]">Bathrooms</h3>
                    <p className="text-xs text-[#6B6B67]">Full and half bathrooms</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setBathrooms((b) => Math.max(1, b - 0.5))}
                      className="w-9 h-9 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] flex items-center justify-center font-bold text-base hover:bg-neutral-100"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="w-6 text-center font-bold text-base">{bathrooms}</span>
                    <button
                      type="button"
                      onClick={() => setBathrooms((b) => Math.min(10, b + 0.5))}
                      className="w-9 h-9 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] flex items-center justify-center font-bold text-base hover:bg-neutral-100"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Amenities ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-[#171717]">Amenities</h2>
                <p className="text-sm text-[#6B6B67] mt-0.5">
                  Highlight features that travelers look for when booking long or short stays in Nigeria.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {AVAILABLE_AMENITIES.map((name) => {
                  const isSelected = selectedAmenities.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleAmenity(name)}
                      className={`text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-[#EDF3F0] border-[#0B5D45] text-[#0B5D45] font-semibold"
                          : "bg-white border-[#E7E5E0] text-[#171717] hover:border-[#8B8B86]"
                      }`}
                    >
                      <span className="text-xs sm:text-sm">{name}</span>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isSelected
                            ? "bg-[#0B5D45] border-[#0B5D45] text-white"
                            : "border-[#C9C7C1]"
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 5: Photos (Cloudflare R2) ── */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-[#171717]">Photos</h2>
                <p className="text-sm text-[#6B6B67] mt-0.5">
                  Upload crisp photos of your rooms, natural lighting, and exterior. Stored securely on Cloudflare R2.
                </p>
              </div>

              {/* Upload Input */}
              <div className="border-2 border-dashed border-[#C9C7C1] hover:border-[#0B5D45] rounded-2xl p-6 sm:p-8 text-center transition-colors">
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center">
                    {uploadingImage ? (
                      <Loader2 size={24} className="animate-spin" />
                    ) : (
                      <Upload size={24} />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[#171717]">
                    {uploadingImage ? "Uploading to Cloudflare R2..." : "Click to upload an image"}
                  </p>
                  <p className="text-xs text-[#8B8B86]">PNG, JPG, WEBP up to 10MB</p>
                </label>
              </div>

              {/* Images Grid */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((url, idx) => (
                    <div
                      key={url}
                      className="relative h-28 rounded-xl overflow-hidden bg-neutral-100 group border border-[#E7E5E0]"
                    >
                      <Image src={url} alt={`Listing ${idx + 1}`} fill className="object-cover" />
                      {idx === 0 && (
                        <span className="absolute bottom-2 left-2 bg-[#0B5D45] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 6: Pricing & Power Infrastructure ── */}
          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-[#171717]">Pricing &amp; Power</h2>
                <p className="text-sm text-[#6B6B67] mt-0.5">
                  Set your nightly rate in Nigerian Naira (₦) and declare your power system.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1.5">
                    Price Per Night (₦ NGN) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-base font-bold text-[#6B6B67]">
                      ₦
                    </span>
                    <input
                      type="number"
                      step={1000}
                      min={5000}
                      value={pricePerNight}
                      onChange={(e) => setPricePerNight(Number(e.target.value))}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-[#E7E5E0] text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#0B5D45]"
                    />
                  </div>
                  <p className="text-xs text-[#8B8B86] mt-1">
                    Minimum ₦5,000 / night. Ilé service fee (8%) is handled automatically.
                  </p>
                </div>

                <div className="border-t border-[#F2F0EB] pt-4 space-y-3">
                  <h3 className="text-sm font-bold text-[#171717]">
                    Power Guarantee (Crucial for Nigeria)
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1.5">
                      Power Setup *
                    </label>
                    <select
                      value={powerType}
                      onChange={(e) => setPowerType(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl border border-[#E7E5E0] bg-white text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0B5D45]"
                    >
                      <option value="Solar + Inverter with Generator Backup">
                        Solar + Inverter with Generator Backup (24/7)
                      </option>
                      <option value="Dedicated Soundproof Generator">
                        Dedicated Soundproof Generator (Continuous)
                      </option>
                      <option value="Inverter + Grid Hybrid">Inverter + Grid Hybrid</option>
                      <option value="Estate Central Power Grid">Estate Central Power Grid</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-1.5">
                      Power Details
                    </label>
                    <textarea
                      rows={2}
                      value={powerDescription}
                      onChange={(e) => setPowerDescription(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E7E5E0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5D45]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 7: Review & Submit ── */}
          {step === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[#171717]">Review &amp; Submit</h2>
                <p className="text-sm text-[#6B6B67] mt-0.5">
                  Confirm your listing details before submitting to the administration team.
                </p>
              </div>

              <div className="bg-[#FAF9F6] border border-[#E7E5E0] rounded-xl p-5 space-y-4 text-sm divide-y divide-[#E7E5E0]">
                <div className="space-y-1">
                  <span className="text-xs uppercase font-semibold text-[#8B8B86]">Title &amp; Type</span>
                  <p className="text-base font-bold text-[#171717]">{title || "Untitled Property"}</p>
                  <p className="text-xs text-[#6B6B67]">
                    {propertyType} · {spaceType} · {maxGuests} guests
                  </p>
                </div>

                <div className="pt-3 space-y-1">
                  <span className="text-xs uppercase font-semibold text-[#8B8B86]">Location</span>
                  <p className="font-semibold text-[#171717]">
                    {selectedLocation ? selectedLocation.displayName : "No location selected yet"}
                  </p>
                  <p className="text-xs text-[#6B6B67]">
                    Private address: {exactAddress || "Not entered"}
                  </p>
                </div>

                <div className="pt-3 space-y-1">
                  <span className="text-xs uppercase font-semibold text-[#8B8B86]">Pricing</span>
                  <p className="text-base font-bold text-[#0B5D45]">
                    ₦{pricePerNight.toLocaleString()} / night
                  </p>
                </div>

                <div className="pt-3 space-y-1">
                  <span className="text-xs uppercase font-semibold text-[#8B8B86]">Photos &amp; Amenities</span>
                  <p className="text-xs text-[#6B6B67]">
                    {images.length} photos uploaded · {selectedAmenities.length} amenities selected
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#EDF3F0] text-xs text-[#0B5D45] flex items-start gap-2.5">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Upon submission, your property will enter <strong>PENDING_REVIEW</strong>. An administrator will verify the listing before making it active.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between pt-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E7E5E0] bg-white text-sm font-semibold text-[#171717] hover:bg-neutral-50 transition-colors"
            >
              <ChevronLeft size={16} />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveDraft}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-[#E7E5E0] bg-white text-sm font-semibold text-[#6B6B67] hover:text-[#171717] transition-colors"
            >
              {isSaving ? "Saving..." : "Save Draft"}
            </button>

            {step < 7 ? (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#0B5D45] text-white hover:bg-[#084936] text-sm font-semibold transition-colors shadow-sm"
              >
                <span>Continue</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitForReview}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B5D45] text-white hover:bg-[#084936] text-sm font-semibold transition-colors shadow-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Submit for Review</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
