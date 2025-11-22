"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type VCUser = {
  did: string;
  holderName: string;
  vcType: string;
  trialId: string;
  status: "Eligible" | "Not eligible" | "Pending Evaluation";
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  clinicalSite?: string;
};

export type VCAuthContextValue = {
  user: VCUser | null;
  loading: boolean;
  error: string | null;
  loginWithMockVC: () => Promise<void>;
  logout: () => void;
};

const VCAuthContext = createContext<VCAuthContextValue | undefined>(undefined);

export default function VCAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<VCUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginWithMockVC = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));

      const didLoginUrl = process.env.NEXT_PUBLIC_DID_LOGIN_URL;
      if (didLoginUrl) {
        try {
          await fetch(didLoginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              flow: "vc-login",
              source: "web-demo",
            }),
          });
        } catch (networkError) {
          console.warn("DID/DWN login endpoint not available, using mocked VC:", networkError);
        }
      }

      const mockUser: VCUser = {
        did: "did:example:patient-123456789abcdef",
        holderName: "Mary Perez",
        vcType: "EligibilityCredential",
        trialId: "ALZ-2025-01",
        status: "Pending Evaluation",
        issuer: "Proof of Eligibility · Oasis TEE Attestation",
        issuedAt: "2025-11-16T10:15:00Z",
        expiresAt: "2026-11-16T10:15:00Z",
        clinicalSite: "Memory Center · Buenos Aires",
      };

      setUser(mockUser);
    } catch (e) {
      setError("We couldn't connect your credential. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setError(null);
  }, []);

  const value: VCAuthContextValue = {
    user,
    loading,
    error,
    loginWithMockVC,
    logout,
  };

  return <VCAuthContext.Provider value={value}>{children}</VCAuthContext.Provider>;
}

export function useVCAuth(): VCAuthContextValue {
  const ctx = useContext(VCAuthContext);
  if (!ctx) {
    throw new Error("useVCAuth must be used within a VCAuthProvider");
  }
  return ctx;
}
