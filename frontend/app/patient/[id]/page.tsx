"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

// Vista de detalle de paciente orientada a demo: usa el ID en la URL y muestra
// información simulada coherente con la app de Explore.
export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";

  // Datos simulados derivados del ID, para demo
  const pseudo = useMemo(() => {
    const num = id.replace(/[^0-9]/g, "") || "001";
    return {
      pseudoId: `SCR-${id}`,
      patientLabel: `Paciente ${num}`,
    };
  }, [id]);

  const engineVersion = "v1.3.2";
  const engineHash = "0x9f3a21";
  const screeningHash = `0xscr${id.replace(/[^0-9]/g, "").padEnd(6, "0")}`;
  const vcTxHash = `0xvc${id.replace(/[^0-9]/g, "").padEnd(6, "0")}`;

  const timeline = useMemo(
    () => [
      {
        label: "Screening inicial (off-chain)",
        date: "2025-11-15",
        detail:
          "Formulario completado por el paciente en modo usuario. El resultado se prepara para ser firmado.",
        extra: `Screening hash (pre-TEE): ${screeningHash}`,
      },
      {
        label: "Evaluación automática en TEE Oasis + hash on-chain",
        date: "2025-11-16",
        detail:
          "Motor de elegibilidad ejecutado sobre FHIR QuestionnaireResponse dentro de un TEE descentralizado (Oasis Foundation). El enclave firma el resultado y publica el hash de screening en Ethereum.",
        extra: `Motor: ${engineVersion} (hash ${engineHash})`,
      },
      {
        label: "Emisión de Verified Credential on-chain",
        date: "2025-11-16",
        detail:
          "VC de elegibilidad emitida y registrada en un contrato verificador. Los datos de la transacción se consultan vía explorador tipo ETHExplorer/Etherscan.",
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
              Detalle de paciente · <span className="font-normal">{pseudo.patientLabel}</span>
            </h1>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Pseudo-ID: <span className="font-mono">{pseudo.pseudoId}</span>
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="text-[11px] px-3 py-1.5 rounded-full border border-slate-500 hover:border-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>
        </div>

        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-900">
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Snapshot clínico
            </h2>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-1 text-xs">
              <p>
                <span className="font-medium">Estado de elegibilidad:</span> Simulado desde vista Explore y
                enlazado conceptualmente a eventos on-chain (emisión de VC).
              </p>
              <p>
                <span className="font-medium">Dx previo:</span> Se obtiene del backend compartido con Explore.
              </p>
              <p>
                <span className="font-medium">Ensayo clínico asignado:</span> Se alinea con el campo
                <code className="px-1 mx-1 rounded bg-slate-200 text-[10px]">estudioClinico</code> usado en el mapa.
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Esta vista está preparada para consumir el mismo endpoint de pacientes que la pantalla Explore y
                cruzar esos datos con un explorador de Ethereum (ej. Etherscan/ETHExplorer) para mostrar el rastro
                criptográfico de cada movimiento.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Timeline de movimientos
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
            Esta pantalla está pensada como vista de auditoría para farmacéuticas y CROs.
          </p>
          <button
            onClick={() => router.push("/explore")}
            className="text-[11px] px-3 py-1.5 rounded-full border border-sky-600 text-sky-700 hover:bg-sky-50 transition-colors"
          >
            Volver a Explore
          </button>
        </div>
      </div>
    </div>
  );
}
