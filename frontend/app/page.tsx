"use client";

import { useState } from "react";
import type { ScreeningFormData, SexoBiologico } from "./screeningTypes";
import { useVCAuth } from "./VCAuthProvider";
import { DarkCard, PrimaryButton, StepHeader } from "./ui";
import { generateTrialFormVC, grantAccessToDid, writeVCToDwn } from "@/utils/did";

const initialFormData: ScreeningFormData = {
  edad: null,
  sexoBiologico: "",
  diagnosticoPrevio: "",
  sintomas: [],
  pruebaCognitivaReciente: "",
  puntajePrueba: null,
  antecedentesFamiliares: "",
  condicionesMedicas: [],
  medicacionesActuales: [],
  participacionEnsayos: "",
  antecedentesACVConvulsiones: "",
  otrasDemencias: [],
  consentimiento: false,
};

const EVALUATE_ELIGIBILITY_URL =
  "http://localhost:3001/evaluateEligibility";

const ENCRYPTION_KEY_BASE64 = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "";

async function getCryptoKey(): Promise<CryptoKey> {
  if (!ENCRYPTION_KEY_BASE64) {
    throw new Error("NEXT_PUBLIC_ENCRYPTION_KEY is not defined");
  }

  const raw = Uint8Array.from(atob(ENCRYPTION_KEY_BASE64), (c) => c.charCodeAt(0));
  if (raw.byteLength !== 32) {
    throw new Error("NEXT_PUBLIC_ENCRYPTION_KEY must be a 32-byte base64 key (AES-256)");
  }

  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
}

async function encryptPayload(data: unknown): Promise<{ iv: string; ciphertext: string }> {
  const key = await getCryptoKey();
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    plaintext
  );

  const cipherBytes = new Uint8Array(ciphertextBuffer);

  const ivBase64 = btoa(String.fromCharCode(...iv));
  const cipherBase64 = btoa(String.fromCharCode(...cipherBytes));

  return {
    iv: ivBase64,
    ciphertext: cipherBase64,
  };
}

function buildFhirQuestionnaireResponse(formData: ScreeningFormData) {
  return {
    resourceType: "QuestionnaireResponse",
    status: "completed",
    authored: new Date().toISOString(),
    item: [
      {
        linkId: "1",
        text: "Basic patient data",
        item: [
          {
            linkId: "1.1",
            text: "Age",
            answer: formData.edad != null ? [{ valueInteger: formData.edad }] : [],
          },
          {
            linkId: "1.2",
            text: "Biological sex",
            answer: formData.sexoBiologico
              ? [{ valueString: formData.sexoBiologico }]
              : [],
          },
        ],
      },
      {
        linkId: "2",
        text: "Diagnosis and symptoms",
        item: [
          {
            linkId: "2.1",
            text: "Previous diagnosis",
            answer: formData.diagnosticoPrevio
              ? [{ valueString: formData.diagnosticoPrevio }]
              : [],
          },
          {
            linkId: "2.2",
            text: "Symptoms in the last 6 months",
            answer: formData.sintomas.map((s) => ({ valueString: s })),
          },
          {
            linkId: "2.3",
            text: "Recent cognitive test",
            answer: formData.pruebaCognitivaReciente
              ? [{ valueString: formData.pruebaCognitivaReciente }]
              : [],
          },
          {
            linkId: "2.4",
            text: "MoCA/MMSE score",
            answer:
              formData.puntajePrueba != null
                ? [{ valueInteger: formData.puntajePrueba }]
                : [],
          },
        ],
      },
      {
        linkId: "3",
        text: "Clinical history",
        item: [
          {
            linkId: "3.1",
            text: "Family history",
            answer: formData.antecedentesFamiliares
              ? [{ valueString: formData.antecedentesFamiliares }]
              : [],
          },
          {
            linkId: "3.2",
            text: "Medical conditions",
            answer: formData.condicionesMedicas.map((c) => ({ valueString: c })),
          },
          {
            linkId: "3.3",
            text: "Current medications",
            answer: formData.medicacionesActuales.map((m) => ({ valueString: m })),
          },
        ],
      },
      {
        linkId: "4",
        text: "Exclusion criteria",
        item: [
          {
            linkId: "4.1",
            text: "Participation in other trials",
            answer: formData.participacionEnsayos
              ? [{ valueString: formData.participacionEnsayos }]
              : [],
          },
          {
            linkId: "4.2",
            text: "History of stroke or seizures",
            answer: formData.antecedentesACVConvulsiones
              ? [{ valueString: formData.antecedentesACVConvulsiones }]
              : [],
          },
          {
            linkId: "4.3",
            text: "Other dementia diagnoses",
            answer: formData.otrasDemencias.map((d) => ({ valueString: d })),
          },
        ],
      },
      {
        linkId: "5",
        text: "Consent",
        item: [
          {
            linkId: "5.1",
            text: "Consent for secure processing",
            answer: [{ valueBoolean: formData.consentimiento }],
          },
        ],
      },
    ],
  };
}

export default function Home() {
  const { user, loading, error, loginWithMockVC, bearerDid } = useVCAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<ScreeningFormData>(initialFormData);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [step4Error, setStep4Error] = useState<string | null>(null);
  const [step5Error, setStep5Error] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [qrShown, setQrShown] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [vcResult, setVcResult] = useState<any | null>(null);
  const [vcError, setVcError] = useState<string | null>(null);
  const [submittingVC, setSubmittingVC] = useState<boolean>(false);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8">
        <DarkCard className="max-w-md mx-auto overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#38bdf8_0,_transparent_55%),_radial-gradient(circle_at_bottom,_#0f172a_0,_transparent_60%)] opacity-60" />
          <div className="relative text-slate-50">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">Patient mode</p>
                <h1 className="mt-1 text-lg font-semibold">Connect your eligibility credential</h1>
              </div>
              <div className="h-10 w-10 rounded-2xl border border-sky-400/70 bg-sky-500/20 flex items-center justify-center text-xs font-semibold">
                VC
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-200/90 mb-6">
              <p>
                Scan your Verified Credential to start the pre-screening.



              </p>
              <p>
                Your data stays private and is processed securely.
              </p>
              <p className="text-xs text-slate-400">
                Your participation helps advance Alzheimer’s research.
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                {error}
              </div>
            )}
            {!qrShown && (
              <>
                <PrimaryButton
                  type="button"
                  onClick={() => setQrShown(true)}
                  disabled={loading}
                  loading={loading}
                  className="w-full py-3"
                >
                  Sync
                </PrimaryButton>

                <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
                  <span>DID - DWN · VC</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    GDPR, HIPAA Compliance
                  </span>
                </div>
              </>
            )}

            {qrShown && (
              <div className="mt-4 space-y-4">
                <div className="mx-auto w-52 h-52 rounded-2xl bg-slate-900/80 border border-sky-400/70 flex items-center justify-center cursor-pointer hover:border-sky-300 hover:bg-slate-800/80 transition-colors"
                  onClick={async () => {
                    if (confirming || loading) return;
                    setConfirming(true);
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                    await loginWithMockVC();
                    setConfirming(false);
                  }}
                >
                  <div
                    className="w-40 h-40 flex items-center justify-center bg-slate-900/90 rounded-md bg-center bg-cover"
                    style={{ backgroundImage: "url(/qr-demo.svg)" }}
                  >
                    <span className="text-[11px] font-medium tracking-wide text-slate-50/80 bg-black/40 px-2 py-1 rounded-full">

                    </span>
                  </div>
                </div>

                {(confirming || loading) && (
                  <div className="flex flex-col items-center gap-2 text-[11px] text-slate-200/90">
                    <div className="h-4 w-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                    <p>Waiting for synchronization from your mobile wallet…</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Scan to authorize the connection.</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    GDPR, HIPAA Compliance
                  </span>
                </div>
              </div>
            )}
          </div>
        </DarkCard>
      </div>
    );
  }

  const isStep1Valid = (): boolean => {
    if (formData.edad === null || Number.isNaN(formData.edad)) return false;
    if (formData.edad <= 0 || formData.edad >= 120) return false;
    if (!formData.sexoBiologico) return false;
    return true;
  };

  const isStep2Valid = (): boolean => {
    if (!formData.diagnosticoPrevio) return false;
    if (!formData.sintomas || formData.sintomas.length === 0) return false;
    if (!formData.pruebaCognitivaReciente) return false;
    if (
      formData.pruebaCognitivaReciente === "Yes, and I know the result" &&
      formData.puntajePrueba !== null &&
      formData.puntajePrueba !== undefined
    ) {
      if (formData.puntajePrueba < 0 || formData.puntajePrueba > 30) return false;
    }
    return true;
  };

  const isStep3Valid = (): boolean => {
    if (!formData.antecedentesFamiliares) return false;
    if (!formData.condicionesMedicas || formData.condicionesMedicas.length === 0)
      return false;
    if (!formData.medicacionesActuales || formData.medicacionesActuales.length === 0)
      return false;
    return true;
  };

  const isStep4Valid = (): boolean => {
    if (!formData.participacionEnsayos) return false;
    if (!formData.antecedentesACVConvulsiones) return false;
    if (!formData.otrasDemencias || formData.otrasDemencias.length === 0) return false;
    return true;
  };

  const isStep5Valid = (): boolean => {
    return formData.consentimiento === true;
  };

  const handleEdadChange = (value: string) => {
    setStep1Error(null);
    if (value === "") {
      setFormData((prev) => ({ ...prev, edad: null }));
      return;
    }
    const num = Number(value);
    setFormData((prev) => ({ ...prev, edad: Number.isNaN(num) ? null : num }));
  };

  const handleSexoChange = (value: string) => {
    setStep1Error(null);
    setFormData((prev) => ({ ...prev, sexoBiologico: value as SexoBiologico }));
  };

  const handleFillWithDummyData = () => {
    setStep1Error(null);
    setStep2Error(null);
    setStep3Error(null);
    setStep4Error(null);
    setStep5Error(null);

    setFormData({
      edad: 70,
      sexoBiologico: "Male",
      diagnosticoPrevio: "Yes, Mild Cognitive Impairment (MCI)",
      sintomas: ["Recent memory loss"],
      pruebaCognitivaReciente: "Yes, and I know the result",
      puntajePrueba: 23,
      antecedentesFamiliares: "Yes, grandparent",
      condicionesMedicas: ["Hipertensión"],
      medicacionesActuales: [
        "Inhibidores de colinesterasa (donepezilo, rivastigmina)",
      ],
      participacionEnsayos: "No",
      antecedentesACVConvulsiones: "No",
      otrasDemencias: ["No"],
      consentimiento: true,
    });

    setCurrentStep(5);
  };

  const handleNextFromStep1 = () => {
    if (!isStep1Valid()) {
      setStep1Error(
        "Please review your age (between 1 and 119 years) and select a biological sex."
      );
      return;
    }
    setStep1Error(null);
    setCurrentStep(2);
  };

  const handleDiagnosticoPrevioChange = (value: string) => {
    setStep2Error(null);
    setFormData((prev) => ({
      ...prev,
      diagnosticoPrevio: value as ScreeningFormData["diagnosticoPrevio"],
    }));
  };

  const toggleSintoma = (value: string) => {
    setStep2Error(null);
    setFormData((prev) => {
      const current = prev.sintomas;
      if (current.includes(value)) {
        return { ...prev, sintomas: current.filter((v) => v !== value) };
      }
      return { ...prev, sintomas: [...current, value] };
    });
  };

  const handlePruebaCognitivaChange = (value: string) => {
    setStep2Error(null);
    setFormData((prev) => ({
      ...prev,
      pruebaCognitivaReciente:
        value as ScreeningFormData["pruebaCognitivaReciente"],
    }));
  };

  const handlePuntajeChange = (value: string) => {
    setStep2Error(null);
    if (value === "") {
      setFormData((prev) => ({ ...prev, puntajePrueba: null }));
      return;
    }
    const num = Number(value);
    setFormData((prev) => ({
      ...prev,
      puntajePrueba: Number.isNaN(num) ? null : num,
    }));
  };

  const handleNextFromStep2 = () => {
    if (!isStep2Valid()) {
      setStep2Error(
        "Please complete previous diagnosis, at least one symptom, and an answer about the cognitive test (if you provide a score, it must be between 0 and 30)."
      );
      return;
    }
    setStep2Error(null);
    setCurrentStep(3);
  };

  const handleAntecedentesFamiliaresChange = (value: string) => {
    setStep3Error(null);
    setFormData((prev) => ({
      ...prev,
      antecedentesFamiliares:
        value as ScreeningFormData["antecedentesFamiliares"],
    }));
  };

  const toggleCondicionMedica = (value: string) => {
    setStep3Error(null);
    setFormData((prev) => {
      const current = prev.condicionesMedicas;
      if (current.includes(value)) {
        return { ...prev, condicionesMedicas: current.filter((v) => v !== value) };
      }
      return { ...prev, condicionesMedicas: [...current, value] };
    });
  };

  const toggleMedicacion = (value: string) => {
    setStep3Error(null);
    setFormData((prev) => {
      const current = prev.medicacionesActuales;
      if (current.includes(value)) {
        return {
          ...prev,
          medicacionesActuales: current.filter((v) => v !== value),
        };
      }
      return { ...prev, medicacionesActuales: [...current, value] };
    });
  };

  const handleNextFromStep3 = () => {
    if (!isStep3Valid()) {
      setStep3Error(
        "Please complete family history, at least one medical condition, and at least one current medication."
      );
      return;
    }
    setStep3Error(null);
    setCurrentStep(4);
  };

  const handleParticipacionEnsayosChange = (value: string) => {
    setStep4Error(null);
    setFormData((prev) => ({
      ...prev,
      participacionEnsayos: value as ScreeningFormData["participacionEnsayos"],
    }));
  };

  const handleACVConvulsionesChange = (value: string) => {
    setStep4Error(null);
    setFormData((prev) => ({
      ...prev,
      antecedentesACVConvulsiones:
        value as ScreeningFormData["antecedentesACVConvulsiones"],
    }));
  };

  const toggleOtraDemencia = (value: string) => {
    setStep4Error(null);
    setFormData((prev) => {
      const current = prev.otrasDemencias;
      if (current.includes(value)) {
        return { ...prev, otrasDemencias: current.filter((v) => v !== value) };
      }
      return { ...prev, otrasDemencias: [...current, value] };
    });
  };

  const handleNextFromStep4 = () => {
    if (!isStep4Valid()) {
      setStep4Error(
        "Please complete participation in trials, history of stroke/seizures, and at least one option in other dementia diagnoses."
      );
      return;
    }
    setStep4Error(null);
    setCurrentStep(5);
  };

  const handleConsentimientoChange = (checked: boolean) => {
    setStep5Error(null);
    setFormData((prev) => ({ ...prev, consentimiento: checked }));
  };

  const handleSubmit = async () => {
    if (!isStep5Valid()) {
      setStep5Error("You must accept the consent to continue.");
      return;
    }
    setStep5Error(null);
    setVcError(null);

    // Get user DID from the provider
    let userDid = bearerDid;

    if (!userDid) {
      setVcError("No user DID available. Please select a user from the dropdown.");
      return;
    }

    console.log("Using DID for submission:", userDid.uri);

    // // give the tee procees permissions to read user's vcs from dwn
    // await grantAccessToDid(userDid, process.env.NEXT_PUBLIC_TEE_PROCESS_DID || "", {
    //   scope: {
    //     method: 'RecordsRead',
    //     schema: 'https://schema.org/VerifiableCredential',
    //   },
    // });

    const fhirPayload = buildFhirQuestionnaireResponse(formData);

    // create a vc for the did with the fhir payload
    const vc = await generateTrialFormVC(userDid, fhirPayload);

    try {
      const encrypted = await encryptPayload({ vc, dwn: process.env.NEXT_PUBLIC_DWN_SERVER_URL || "" });

      const response = await fetch(EVALUATE_ELIGIBILITY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(encrypted),
      });

      console.log("evaluateEligibility status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("evaluateEligibility error body:", errorText);
        setVcError(`Backend error (${response.status}): ${errorText || "Unknown error"}`);
      } else {
        const vcJson = await response.json();
        console.log("evaluateEligibility VC:", vcJson);
        setVcResult(vcJson);
      }
    } catch (error) {
      console.error("Error calling evaluateEligibility:", error);
      setVcError("Error calling evaluateEligibility. Check console for details.");
    }
    setSubmittingVC(true);
    setSubmitted(true);
    const bearerDidSigner = await userDid.getSigner();
    try {
      await writeVCToDwn(vc, process.env.NEXT_PUBLIC_DWN_SERVER_URL || "", bearerDidSigner, userDid.uri);
    } catch (error) {
      console.error("Error writing VC to DWN:", error);
      setVcError("Error writing VC to DWN. Check console for details.");
    } finally {
      setSubmittingVC(false);
    }
  };

  const getStepLabel = () => {
    switch (currentStep) {
      case 1:
        return "Basic patient data";
      case 2:
        return "Diagnosis and symptoms";
      case 3:
        return "Clinical history";
      case 4:
        return "Exclusion criteria";
      case 5:
        return "Consent and summary";
      default:
        return "";
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8">
        <main className="w-full max-w-4xl">
          <header className="mb-8 text-center">
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-50">
              Privacy-First Clinical Screening with Confidential Compute
            </h1>
            <p className="mt-2 text-sm md:text-base text-slate-200">
              Eligibility assessment for Alzheimer&apos;s clinical trials, with a strong focus on privacy.
            </p>
            <p className="mt-1 text-xs md:text-sm text-slate-400">Proof of Eligibility</p>
          </header>

          <DarkCard className="p-0">
            <div className="text-sm text-slate-100">
              <h2 className="text-xl md:text-2xl font-semibold mb-2">
                Pre-screening completed
              </h2>
              <p className="text-sm md:text-base text-slate-200 mb-4">
                Your data has been successfully recorded. In a real environment, it would now be encrypted and sent to a secure enclave (Oasis TEE) to evaluate your eligibility in a privacy-preserving way.
              </p>

              <div className="mt-4 text-sm">
                <p className="font-medium mb-2">Summary of your key answers:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <span className="font-semibold">Age:</span> {formData.edad ?? "-"}
                  </li>
                  <li>
                    <span className="font-semibold">Previous diagnosis:</span> {formData.diagnosticoPrevio || "-"}
                  </li>
                  <li>
                    <span className="font-semibold">Reported symptoms:</span>{" "}
                    {formData.sintomas.length > 0 ? formData.sintomas.join(", ") : "-"}
                  </li>
                  <li>
                    <span className="font-semibold">Family history:</span>{" "}
                    {formData.antecedentesFamiliares || "-"}
                  </li>
                </ul>
              </div>

              {vcResult && (
                <div className="mt-6 bg-slate-900/60 border border-slate-800 rounded-lg p-4 text-sm text-slate-100">
                  <p className="text-sm font-medium mb-2">Eligibility credential (VC)</p>
                  <dl className="space-y-1 text-xs md:text-sm">
                    <div className="flex gap-2">
                      <dt className="w-32 font-medium">Issuer:</dt>
                      <dd className="break-all">{vcResult.issuer ?? "-"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-32 font-medium">Subject DID:</dt>
                      <dd className="break-all">{vcResult.credentialSubject?.id ?? "-"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-32 font-medium">Eligibility:</dt>
                      <dd>
                        {vcResult.credentialSubject?.data?.eligibility ? "Eligible" : "Not eligible"}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-32 font-medium">Issued at:</dt>
                      <dd>{vcResult.issuanceDate ?? "-"}</dd>
                    </div>
                    {vcResult.expirationDate && (
                      <div className="flex gap-2">
                        <dt className="w-32 font-medium">Expires:</dt>
                        <dd>{vcResult.expirationDate}</dd>
                      </div>
                    )}
                    {vcResult.id && (
                      <div className="flex gap-2">
                        <dt className="w-32 font-medium">VC ID:</dt>
                        <dd className="break-all">{vcResult.id}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {vcError && (
                <p className="mt-4 text-xs text-red-400">
                  {vcError}
                </p>
              )}
              <div className="mt-4 text-sm">
                {submittingVC && (
                  <p className="text-xs text-slate-200/80">
                    Submitting VC to DWN... This may take a few seconds.
                  </p>
                )}
                {!submittingVC && (
                  <p className="text-xs text-slate-200/80">
                    VC submitted to DWN.
                  </p>
                )}
              </div>
            </div>
          </DarkCard>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8">
      <main className="w-full max-w-4xl">
        <section className="mb-6">
          <DarkCard className="overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_#38bdf8_0,_transparent_60%),_radial-gradient(circle_at_bottom_right,_#0f172a_0,_transparent_60%)] opacity-70" />
            <div className="relative p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-slate-50">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-sky-200/90 mb-1">
                  Verified Credential connected
                </p>
                <h2 className="text-lg md:text-xl font-semibold mb-1">
                  {user.holderName}
                </h2>
                <p className="text-xs text-slate-200/90 mb-3">
                  {user.vcType} · Trial {user.trialId}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-200/80">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="font-medium">Status:</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-[10px] uppercase tracking-wide">
                      {user.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">DID:</span>
                    <span className="font-mono text-[10px] text-slate-200/80">
                      {user.did.slice(0, 14)}…{user.did.slice(-6)}
                    </span>
                  </div>
                  {user.clinicalSite && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">Site:</span>
                      <span>{user.clinicalSite}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 text-[11px] text-slate-200/80 min-w-[150px]">
                <div className="text-right">
                  <p className="font-medium">Issuer</p>
                  <p className="text-[10px] text-slate-200/80">{user.issuer}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-[10px]">
                  <p>
                    Issued: {new Date(user.issuedAt).toLocaleDateString()}
                  </p>
                  {user.expiresAt && (
                    <p className="text-slate-300/80">
                      Expires: {new Date(user.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DarkCard>
        </section>

        <header className="mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-50">
            Privacy-First Clinical Screening with Confidential Compute
          </h1>
          <p className="mt-2 text-sm md:text-base text-slate-200">
            Eligibility assessment for Alzheimer&apos;s clinical trials, with a strong focus on privacy.
          </p>
          <p className="mt-1 text-xs md:text-sm text-slate-400">Proof of Eligibility</p>
        </header>

        <DarkCard>
          <StepHeader currentStep={currentStep} totalSteps={5} label={getStepLabel()} />

          {currentStep === 1 && (
            <>
              <div className="space-y-4">
                <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                  <label className="block text-sm font-medium text-slate-100">
                    What is your age?
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={formData.edad ?? ""}
                    onChange={(e) => handleEdadChange(e.target.value)}
                    placeholder="e.g. 67"
                    className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>

                <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                  <label className="block text-sm font-medium text-slate-100">
                    What is your biological sex?
                  </label>
                  <select
                    value={formData.sexoBiologico}
                    onChange={(e) => handleSexoChange(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 text-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="">Select an option</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              {step1Error && (
                <p className="mt-3 text-xs text-red-400">{step1Error}</p>
              )}

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={handleFillWithDummyData}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-200 border border-slate-700 hover:bg-slate-800 transition-colors"
                >
                  Auto-fill & skip
                </button>
                <PrimaryButton type="button" onClick={handleNextFromStep1}>
                  Next
                </PrimaryButton>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="space-y-4">
                <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                  <p className="block text-sm font-medium text-slate-100">
                    Have you received a previous diagnosis of Mild Cognitive Impairment (MCI) or
                    Alzheimer&apos;s disease?
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-slate-100">
                    {["Yes, Alzheimer's disease", "Yes, Mild Cognitive Impairment (MCI)", "No, but I have symptoms", "No"].map(
                      (opt) => (
                        <label key={opt} className="flex items-center gap-2 text-slate-100">
                          <input
                            type="radio"
                            name="diagnosticoPrevio"
                            value={opt}
                            checked={formData.diagnosticoPrevio === opt}
                            onChange={() => handleDiagnosticoPrevioChange(opt)}
                            className="text-sky-600"
                          />
                          <span>{opt}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                  <p className="block text-sm font-medium text-slate-100">
                    In the last 6 months, have you experienced any of these symptoms?
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-100">
                    {["Recent memory loss", "Difficulty concentrating", "Difficulty finding words", "Problems performing usual tasks", "Mood changes", "None of the above"].map(
                      (opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2 text-slate-100 border border-slate-800"
                        >
                          <input
                            type="checkbox"
                            value={opt}
                            checked={formData.sintomas.includes(opt)}
                            onChange={() => toggleSintoma(opt)}
                            className="text-sky-600"
                          />
                          <span>{opt}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                  <p className="block text-sm font-medium text-slate-100">
                    Have you had a cognitive test recently (for example, MoCA or MMSE)?
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-slate-100">
                    {["Yes, and I know the result", "Yes, but I don't remember the score", "No"].map(
                      (opt) => (
                        <label key={opt} className="flex items-center gap-2 text-slate-100">
                          <input
                            type="radio"
                            name="pruebaCognitivaReciente"
                            value={opt}
                            checked={formData.pruebaCognitivaReciente === opt}
                            onChange={() => handlePruebaCognitivaChange(opt)}
                            className="text-sky-600"
                          />
                          <span>{opt}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                {formData.pruebaCognitivaReciente === "Yes, and I know the result" && (
                  <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                    <label className="block text-sm font-medium text-slate-100">
                      If you remember it, enter your MoCA or MMSE score
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={formData.puntajePrueba ?? ""}
                      onChange={(e) => handlePuntajeChange(e.target.value)}
                      placeholder="e.g. 23"
                      className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 text-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    />
                    <p className="mt-1 text-xs text-slate-300">
                      Campo opcional. Si lo completas, el valor debe estar entre 0 y 30.
                    </p>
                  </div>
                )}
              </div>

              {step2Error && (
                <p className="mt-4 text-xs text-red-400">{step2Error}</p>
              )}

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-200 border border-slate-700 hover:bg-slate-800 transition-colors"
                >
                  Anterior
                </button>
                <PrimaryButton type="button" onClick={handleNextFromStep2}>
                  Siguiente
                </PrimaryButton>
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <div className="space-y-4">
                <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                  <p className="block text-sm font-medium text-slate-100">
                    Do you have a family history of Alzheimer&apos;s disease?
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-slate-100">
                    {[
                      "Yes, parent",
                      "Yes, grandparent",
                      "No",
                      "I don&apos;t know",
                    ].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-slate-100">
                        <input
                          type="radio"
                          name="antecedentesFamiliares"
                          value={opt}
                          checked={formData.antecedentesFamiliares === opt}
                          onChange={() => handleAntecedentesFamiliaresChange(opt)}
                          className="text-sky-600"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                  <p className="block text-sm font-medium text-slate-100">
                    Do you currently have any of these medical conditions?
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-100">
                    {[
                      "Hypertension",
                      "Type 2 diabetes",
                      "Heart disease",
                      "Major depression",
                      "None of the above",
                    ].map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2 text-slate-100 border border-slate-800"
                      >
                        <input
                          type="checkbox"
                          value={opt}
                          checked={formData.condicionesMedicas.includes(opt)}
                          onChange={() => toggleCondicionMedica(opt)}
                          className="text-sky-600"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                  <p className="block text-sm font-medium text-slate-100">
                    Are you currently taking any of these medications?
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-100">
                    {[
                      "Cholinesterase inhibitors (donepezil, rivastigmine)",
                      "Memantine",
                      "Antipsychotics",
                      "Antidepressants",
                      "None of the above",
                    ].map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2 text-slate-100 border border-slate-800"
                      >
                        <input
                          type="checkbox"
                          value={opt}
                          checked={formData.medicacionesActuales.includes(opt)}
                          onChange={() => toggleMedicacion(opt)}
                          className="text-sky-600"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {step3Error && (
                <p className="mt-4 text-xs text-red-400">{step3Error}</p>
              )}

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-200 border border-slate-700 hover:bg-slate-800 transition-colors"
                >
                  Back
                </button>
                <PrimaryButton type="button" onClick={handleNextFromStep3}>
                  Next
                </PrimaryButton>
              </div>
            </>
          )}

          {currentStep === 4 && (
            <>
              <div className="space-y-4">
                <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                  <p className="block text-sm font-medium text-slate-100">
                    Have you participated in another clinical trial in the last 12 months?
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-slate-100">
                    {["Yes", "No"].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-slate-100">
                        <input
                          type="radio"
                          name="participacionEnsayos"
                          value={opt}
                          checked={formData.participacionEnsayos === opt}
                          onChange={() => handleParticipacionEnsayosChange(opt)}
                          className="text-sky-600"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                  <p className="block text-sm font-medium text-slate-100">
                    Do you have a history of stroke or seizures?
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-slate-100">
                    {["Yes", "No"].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-slate-100">
                        <input
                          type="radio"
                          name="antecedentesACVConvulsiones"
                          value={opt}
                          checked={formData.antecedentesACVConvulsiones === opt}
                          onChange={() => handleACVConvulsionesChange(opt)}
                          className="text-sky-600"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                  <p className="block text-sm font-medium text-slate-100">
                    Have you received a diagnosis of a dementia other than Alzheimer&apos;s?
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-100">
                    {["Parkinson&apos;s disease", "Frontotemporal dementia", "Vascular dementia", "No"].map(
                      (opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2 text-slate-100 border border-slate-800"
                        >
                          <input
                            type="checkbox"
                            value={opt}
                            checked={formData.otrasDemencias.includes(opt)}
                            onChange={() => toggleOtraDemencia(opt)}
                            className="text-sky-600"
                          />
                          <span>{opt}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>
              </div>

              {step4Error && (
                <p className="mt-4 text-xs text-red-400">{step4Error}</p>
              )}

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-200 border border-slate-700 hover:bg-slate-800 transition-colors"
                >
                  Back
                </button>
                <PrimaryButton type="button" onClick={handleNextFromStep4}>
                  Next
                </PrimaryButton>
              </div>
            </>
          )}

          {currentStep === 5 && (
            <>
              <div className="space-y-4 text-slate-100 text-sm">
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
                  <h2 className="font-semibold mb-2">Summary of key information</h2>
                  <dl className="space-y-1">
                    <div className="flex gap-2">
                      <dt className="font-medium w-32">Age:</dt>
                      <dd>{formData.edad ?? "Not provided"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium w-32">Previous diagnosis:</dt>
                      <dd>{formData.diagnosticoPrevio || "Not provided"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium w-32">Symptoms:</dt>
                      <dd>
                        {formData.sintomas.length > 0
                          ? formData.sintomas.join(", ")
                          : "Not provided"}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium w-32">Family history:</dt>
                      <dd>{formData.antecedentesFamiliares || "Not provided"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
                  <p className="font-semibold mb-1 text-slate-100">Privacy and secure processing</p>
                  <p className="text-slate-100">
                    Your data is converted into a structured format (FHIR-compatible), encrypted in
                    your browser, and processed inside a secure enclave (confidential compute).
                    No one on the team can see your information in plain text.
                  </p>
                </div>

                <div>
                  <label className="flex items-start gap-2 text-sm text-slate-100">
                    <input
                      type="checkbox"
                      checked={formData.consentimiento}
                      onChange={(e) => handleConsentimientoChange(e.target.checked)}
                      className="mt-0.5 text-sky-600"
                    />
                    <span>
                      I confirm that I authorize the secure and encrypted processing of my data to
                      evaluate my eligibility for this clinical trial.
                    </span>
                  </label>
                </div>
              </div>

              {step5Error && (
                <p className="mt-4 text-xs text-red-400">{step5Error}</p>
              )}

              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-200 border border-slate-700 hover:bg-slate-800 transition-colors"
                >
                  Back
                </button>
                <PrimaryButton type="button" onClick={handleSubmit}>
                  Submit
                </PrimaryButton>
              </div>
            </>
          )}
        </DarkCard>
      </main>
    </div>
  );
}
