"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createDidFromJwk } from "../utils/did";
import type { BearerDid } from "@web5/dids";

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
  selectedUserId: number | null;
  bearerDid: BearerDid | null;
  loginWithMockVC: () => Promise<void>;
  logout: () => void;
  selectUser: (userId: number) => Promise<void>;
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
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [bearerDid, setBearerDid] = useState<BearerDid | null>(null);

  const selectUser = useCallback(async (userId: number) => {
    if (userId < 1 || userId > 5) {
      setError(`Invalid user ID. Must be between 1 and 5.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Next.js replaces process.env.NEXT_PUBLIC_* at build time
      // We need to access each variable directly, not dynamically
      let privateKeyJwk: string | undefined;

      switch (userId) {
        case 1:
          privateKeyJwk = process.env.NEXT_PUBLIC_PRIVATE_KEY_JWK_1;
          break;
        case 2:
          privateKeyJwk = process.env.NEXT_PUBLIC_PRIVATE_KEY_JWK_2;
          break;
        case 3:
          privateKeyJwk = process.env.NEXT_PUBLIC_PRIVATE_KEY_JWK_3;
          break;
        case 4:
          privateKeyJwk = process.env.NEXT_PUBLIC_PRIVATE_KEY_JWK_4;
          break;
        case 5:
          privateKeyJwk = process.env.NEXT_PUBLIC_PRIVATE_KEY_JWK_5;
          break;
      }

      if (!privateKeyJwk) {
        // Debug info
        const envVars = {
          '1': process.env.NEXT_PUBLIC_PRIVATE_KEY_JWK_1 ? '✅' : '❌',
          '2': process.env.NEXT_PUBLIC_PRIVATE_KEY_JWK_2 ? '✅' : '❌',
          '3': process.env.NEXT_PUBLIC_PRIVATE_KEY_JWK_3 ? '✅' : '❌',
          '4': process.env.NEXT_PUBLIC_PRIVATE_KEY_JWK_4 ? '✅' : '❌',
          '5': process.env.NEXT_PUBLIC_PRIVATE_KEY_JWK_5 ? '✅' : '❌',
        };
        console.log('🔍 Environment variables status:', envVars);

        throw new Error(
          `Environment variable NEXT_PUBLIC_PRIVATE_KEY_JWK_${userId} is not set. ` +
          `⚠️ IMPORTANT: Next.js requires a server restart after adding .env.local variables. ` +
          `Please stop the dev server (Ctrl+C) and run 'npm run dev' again.`
        );
      }

      // Remove quotes if present (sometimes .env files have quotes)
      if (privateKeyJwk.startsWith("'") && privateKeyJwk.endsWith("'")) {
        privateKeyJwk = privateKeyJwk.slice(1, -1);
      }
      if (privateKeyJwk.startsWith('"') && privateKeyJwk.endsWith('"')) {
        privateKeyJwk = privateKeyJwk.slice(1, -1);
      }

      // Create DID from the private key
      const did = await createDidFromJwk(privateKeyJwk);
      setBearerDid(did);
      setSelectedUserId(userId);

      // Save to localStorage
      localStorage.setItem("selectedUserId", userId.toString());

      console.log(`✅ User ${userId} selected. DID: ${did.uri}`);
    } catch (e: any) {
      setError(`Error selecting user ${userId}: ${e.message}`);
      console.error("Error selecting user:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load selected user from localStorage on mount
  useEffect(() => {
    const savedUserId = localStorage.getItem("selectedUserId");
    if (savedUserId) {
      const userId = parseInt(savedUserId, 10);
      if (userId >= 1 && userId <= 5) {
        selectUser(userId).catch(console.error);
      }
    }
  }, [selectUser]);

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
    selectedUserId,
    bearerDid,
    loginWithMockVC,
    logout,
    selectUser,
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
