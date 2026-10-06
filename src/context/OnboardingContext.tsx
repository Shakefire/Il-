"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./AuthContext";

export interface OnboardingState {
  // Step 1: Qualification & Business
  hostType: "individual_owner" | "property_manager" | "company";
  companyName: string;
  companyRegNumber: string;
  phone: string;

  // Step 2: Profile & Operating Location
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  residentialAddress: string;
  operatingCity: string;
  operatingAreas: string;
  bio: string;

  // Step 3: Identity KYC
  idType: string;
  idNumber: string;
  idFrontUrl: string;
  idBackUrl: string;
  selfieUrl: string;

  // Step 4: Authority & Bank Details
  authorityDocType: string;
  authorityDocUrl: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;

  // Step 5: Property Draft & Quality Standards
  propertyTitle: string;
  propertyType: string;
  neighborhood: string;
  bedrooms: number;
  bathrooms: number;
  nightlyRate: number;
  powerType: string;
  commitPower: boolean;
  commitSecurity: boolean;
  commitInternet: boolean;
  commitWater: boolean;

  // Status & Verification Lifecycle
  verificationStatus: string;
  reviewFeedback: string | null;
  onboardingStep: number;
  isApplicationSubmitted: boolean;
  isLoaded: boolean;
}

const defaultState: OnboardingState = {
  hostType: "individual_owner",
  companyName: "",
  companyRegNumber: "",
  phone: "",

  firstName: "",
  lastName: "",
  dateOfBirth: "",
  residentialAddress: "",
  operatingCity: "Abuja",
  operatingAreas: "",
  bio: "",

  idType: "nin",
  idNumber: "",
  idFrontUrl: "",
  idBackUrl: "",
  selfieUrl: "",

  authorityDocType: "deed_of_ownership",
  authorityDocUrl: "",
  bankName: "Guaranty Trust Bank (GTBank)",
  bankAccountNumber: "",
  bankAccountName: "",

  propertyTitle: "",
  propertyType: "Apartment",
  neighborhood: "Maitama",
  bedrooms: 2,
  bathrooms: 2,
  nightlyRate: 65000,
  powerType: "Solar + Inverter with Generator Backup",
  commitPower: true,
  commitSecurity: true,
  commitInternet: true,
  commitWater: true,

  verificationStatus: "REGISTERED",
  reviewFeedback: null,
  onboardingStep: 1,
  isApplicationSubmitted: false,
  isLoaded: false,
};

interface OnboardingContextType {
  data: OnboardingState;
  updateData: (patch: Partial<OnboardingState>) => void;
  saveStepData: (stepNumber: number) => Promise<boolean>;
  submitApplication: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;
  isSubmitting: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const STORAGE_KEY = "ile_host_onboarding_draft";

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [data, setData] = useState<OnboardingState>(defaultState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load draft from localStorage & remote API
  const refreshStatus = useCallback(async () => {
    let localDraft: Partial<OnboardingState> = {};
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) localDraft = JSON.parse(saved);
      } catch {
        // ignore parse errors
      }
    }

    let remoteData: Partial<OnboardingState> = {};
    if (isAuthenticated) {
      try {
        const res = await api.getHostOnboardingStatus();
        if (res) {
          const profile = res.profile || {};
          const userObj = res.user || {};
          const draftProp = res.propertyDraft || {};

          remoteData = {
            firstName: userObj.firstName || "",
            lastName: userObj.lastName || "",
            phone: userObj.phone || "",
            hostType: profile.hostType || "individual_owner",
            companyName: profile.companyName || "",
            companyRegNumber: profile.companyRegNumber || "",
            operatingCity: profile.operatingCity || "Abuja",
            operatingAreas: profile.operatingAreas || "",
            bio: profile.bio || "",
            residentialAddress: profile.residentialAddress || "",
            dateOfBirth: profile.dateOfBirth || "",
            idType: profile.idType || "nin",
            idNumber: profile.idNumber || "",
            idFrontUrl: profile.idFrontUrl || "",
            idBackUrl: profile.idBackUrl || "",
            selfieUrl: profile.selfieUrl || "",
            authorityDocType: profile.authorityDocType || "deed_of_ownership",
            authorityDocUrl: profile.authorityDocUrl || "",
            bankName: profile.bankName || "Guaranty Trust Bank (GTBank)",
            bankAccountNumber: profile.bankAccountNumber || "",
            bankAccountName: profile.bankAccountName || "",
            verificationStatus: res.verificationStatus || "REGISTERED",
            reviewFeedback: res.reviewFeedback || null,
            onboardingStep: res.onboardingStep || 1,
            isApplicationSubmitted: ["UNDER_REVIEW", "APPROVED"].includes(res.verificationStatus),
          };

          if (draftProp && draftProp.title) {
            remoteData.propertyTitle = draftProp.title;
            remoteData.propertyType = draftProp.propertyType || "Apartment";
            remoteData.neighborhood = draftProp.neighborhood || "Maitama";
            remoteData.bedrooms = draftProp.bedrooms || 2;
            remoteData.bathrooms = draftProp.bathrooms || 2;
            remoteData.nightlyRate = draftProp.pricePerNight || 65000;
            remoteData.powerType = draftProp.powerType || "Solar + Inverter with Generator Backup";
          }
        }
      } catch (err) {
        console.warn("[Onboarding] Remote status sync notice:", err);
      }
    }

    setData((prev) => ({
      ...prev,
      ...localDraft,
      ...remoteData,
      isLoaded: true,
    }));
  }, [isAuthenticated]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Update data in state & silent auto-save to localStorage
  const updateData = useCallback((patch: Partial<OnboardingState>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota
        }
      }
      return next;
    });

    // Background silent auto-save to backend with debounce (no disruptive UI popups)
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    autoSaveTimeout.current = setTimeout(async () => {
      try {
        if (patch.hostType || patch.companyName || patch.phone || patch.operatingCity || patch.bio) {
          await api.updateHostOnboardingProfile({
            hostType: patch.hostType,
            companyName: patch.companyName,
            companyRegNumber: patch.companyRegNumber,
            phone: patch.phone,
            firstName: patch.firstName,
            lastName: patch.lastName,
            dateOfBirth: patch.dateOfBirth,
            residentialAddress: patch.residentialAddress,
            operatingCity: patch.operatingCity,
            operatingAreas: patch.operatingAreas,
            bio: patch.bio,
          }).catch(() => null);
        }
      } catch {
        // silent background save
      }
    }, 1500);
  }, []);

  // Save specific step payload synchronously to backend
  const saveStepData = useCallback(async (stepNumber: number): Promise<boolean> => {
    try {
      if (stepNumber === 1 || stepNumber === 2) {
        await api.updateHostOnboardingProfile({
          hostType: data.hostType,
          companyName: data.companyName,
          companyRegNumber: data.companyRegNumber,
          phone: data.phone,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
          residentialAddress: data.residentialAddress,
          operatingCity: data.operatingCity,
          operatingAreas: data.operatingAreas,
          bio: data.bio,
        });
      } else if (stepNumber === 3) {
        await api.updateHostOnboardingIdentity({
          idType: data.idType,
          idNumber: data.idNumber,
          idFrontUrl: data.idFrontUrl,
          idBackUrl: data.idBackUrl,
          selfieUrl: data.selfieUrl,
        });
      } else if (stepNumber === 4) {
        await api.updateHostOnboardingAuthority({
          authorityDocType: data.authorityDocType,
          authorityDocUrl: data.authorityDocUrl,
          bankName: data.bankName,
          bankAccountNumber: data.bankAccountNumber,
          bankAccountName: data.bankAccountName,
        });
      } else if (stepNumber === 5) {
        await api.saveHostPropertyDraft({
          title: data.propertyTitle,
          propertyType: data.propertyType,
          neighborhood: data.neighborhood,
          city: data.operatingCity,
          bedrooms: Number(data.bedrooms),
          bathrooms: Number(data.bathrooms),
          nightlyRate: Number(data.nightlyRate),
          powerType: data.powerType,
        });
      }
      return true;
    } catch (err: any) {
      console.warn(`[Onboarding] Error saving step ${stepNumber}:`, err);
      return false;
    }
  }, [data]);

  // Submit complete onboarding dossier
  const submitApplication = useCallback(async (): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      // Ensure latest step data is pushed first
      await saveStepData(4);
      if (data.propertyTitle) await saveStepData(5);

      await api.submitHostOnboarding();
      setData((prev) => ({
        ...prev,
        verificationStatus: "UNDER_REVIEW",
        isApplicationSubmitted: true,
      }));
      return true;
    } catch (err: any) {
      console.error("[Onboarding] Submission error:", err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [data, saveStepData]);

  return (
    <OnboardingContext.Provider
      value={{
        data,
        updateData,
        saveStepData,
        submitApplication,
        refreshStatus,
        isSubmitting,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
