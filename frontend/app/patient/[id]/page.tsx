"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

// Patient detail view for demo purposes: uses the ID in the URL and shows
// simulated information consistent with the Explore app.
export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";

  // Datos simulados derivados del ID, para demo
  const pseudo = useMemo(() => {
    const num = id.replace(/[^0-9]/g, "") || "001";
    return {
      pseudoId: `SCR-${id}`,
      patientLabel: `Patient ${num}`,
    };
  }, [id]);

  const engineVersion = "v1.3.2";
  const engineHash = "0x9f3a21";
  const screeningHash = `0xscr${id.replace(/[^0-9]/g, "").padEnd(6, "0")}`;
  const vcTxHash = `0xvc${id.replace(/[^0-9]/g, "").padEnd(6, "0")}`;

  const timeline = useMemo(
    () => [
      {
        label: "Initial screening (off-chain)",
        date: "2025-11-15",
        detail:
          "Form completed by the patient in user mode. The result is prepared to be signed.",
        extra: `Screening hash (pre-TEE): ${screeningHash}`,
      },
      {
        label: "Automatic evaluation in Oasis TEE + on-chain hash",
        date: "2025-11-16",
        detail:
          "Eligibility engine executed over a FHIR QuestionnaireResponse inside a decentralized TEE (Oasis Foundation). The enclave signs the result and publishes the screening hash on Ethereum.",
        extra: `Motor: ${engineVersion} (hash ${engineHash})`,
      },
      {
        label: "Verified Credential issuance on-chain",
        date: "2025-11-16",
        detail:
          "Eligibility VC issued and registered in a verifier contract. Transaction data can be retrieved via an explorer such as ETHExplorer/Etherscan.",
        extra: `Tx VC hash: ${vcTxHash}`,
      },
    ],
    [engineHash, engineVersion, screeningHash, vcTxHash]
  );

  return (
    <div className="min-h-screen bg-slate-900/60 flex items-center justify-center px-4">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-slate-50">
          <div>
            <h1 className="text-sm font-semibold">
              Patient detail · <span className="font-normal">{pseudo.patientLabel}</span>
            </h1>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Pseudo-ID: <span className="font-mono">{pseudo.pseudoId}</span>
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="text-[11px] px-3 py-1.5 rounded-full border border-slate-500 hover:border-slate-300 hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-900">
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Clinical snapshot
            </h2>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-1 text-xs">
              <p>
                <span className="font-medium">Eligibility status:</span> Simulated from the Explore view and
                conceptually linked to on-chain events (VC issuance).
              </p>
              <p>
                <span className="font-medium">Previous diagnosis:</span> Retrieved from the backend shared with Explore.
              </p>
              <p>
                <span className="font-medium">Assigned clinical trial:</span> Aligned with the
                <code className="px-1 mx-1 rounded bg-slate-200 text-[10px]">estudioClinico</code> field used on the map.
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                This view is designed to consume the same patients endpoint as the Explore screen and
                cross those data with an Ethereum explorer (e.g. Etherscan/ETHExplorer) to show the cryptographic
                trail of each operation.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Activity timeline
            </h2>
            <ol className="relative border-l border-slate-200 ml-2 text-xs">
              {timeline.map((item) => (
                <li key={item.label} className="mb-4 ml-4">
                  <div className="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full bg-sky-600 border border-white" />
                  <p className="text-[11px] text-slate-500">{item.date}</p>
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <p className="text-[11px] text-slate-600">{item.detail}</p>
                  {item.extra && (
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 break-all">
                      {item.extra}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            This screen is intended as an audit view for pharmaceutical sponsors and CROs.
          </p>
          <button
            onClick={() => router.push("/explore")}
            className="text-[11px] px-3 py-1.5 rounded-full border border-sky-600 text-sky-700 hover:bg-sky-50 transition-colors"
          >
            Back to Explore
          </button>
        </div>
      </div>
    </div>
  );
}
