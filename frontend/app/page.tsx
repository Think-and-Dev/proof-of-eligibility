"use client";

import { useState } from "react";
import type { ScreeningFormData, SexoBiologico } from "./screeningTypes";

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
  "https://p3000.m1104.test-proxy-b.rofl.app/evaluateEligibility";

function buildFhirQuestionnaireResponse(formData: ScreeningFormData) {
  return {
    resourceType: "QuestionnaireResponse",
    status: "completed",
    authored: new Date().toISOString(),
    item: [
      {
        linkId: "1",
        text: "Datos básicos del paciente",
        item: [
          {
            linkId: "1.1",
            text: "Edad",
            answer: formData.edad != null ? [{ valueInteger: formData.edad }] : [],
          },
          {
            linkId: "1.2",
            text: "Sexo biológico",
            answer: formData.sexoBiologico
              ? [{ valueString: formData.sexoBiologico }]
              : [],
          },
        ],
      },
      {
        linkId: "2",
        text: "Diagnóstico y síntomas",
        item: [
          {
            linkId: "2.1",
            text: "Diagnóstico previo",
            answer: formData.diagnosticoPrevio
              ? [{ valueString: formData.diagnosticoPrevio }]
              : [],
          },
          {
            linkId: "2.2",
            text: "Síntomas últimos 6 meses",
            answer: formData.sintomas.map((s) => ({ valueString: s })),
          },
          {
            linkId: "2.3",
            text: "Prueba cognitiva reciente",
            answer: formData.pruebaCognitivaReciente
              ? [{ valueString: formData.pruebaCognitivaReciente }]
              : [],
          },
          {
            linkId: "2.4",
            text: "Puntaje MoCA/MMSE",
            answer:
              formData.puntajePrueba != null
                ? [{ valueInteger: formData.puntajePrueba }]
                : [],
          },
        ],
      },
      {
        linkId: "3",
        text: "Historial clínico",
        item: [
          {
            linkId: "3.1",
            text: "Antecedentes familiares",
            answer: formData.antecedentesFamiliares
              ? [{ valueString: formData.antecedentesFamiliares }]
              : [],
          },
          {
            linkId: "3.2",
            text: "Condiciones médicas",
            answer: formData.condicionesMedicas.map((c) => ({ valueString: c })),
          },
          {
            linkId: "3.3",
            text: "Medicaciones actuales",
            answer: formData.medicacionesActuales.map((m) => ({ valueString: m })),
          },
        ],
      },
      {
        linkId: "4",
        text: "Criterios de exclusión",
        item: [
          {
            linkId: "4.1",
            text: "Participación en otros ensayos",
            answer: formData.participacionEnsayos
              ? [{ valueString: formData.participacionEnsayos }]
              : [],
          },
          {
            linkId: "4.2",
            text: "Antecedentes de ACV o convulsiones",
            answer: formData.antecedentesACVConvulsiones
              ? [{ valueString: formData.antecedentesACVConvulsiones }]
              : [],
          },
          {
            linkId: "4.3",
            text: "Otros diagnósticos de demencia",
            answer: formData.otrasDemencias.map((d) => ({ valueString: d })),
          },
        ],
      },
      {
        linkId: "5",
        text: "Consentimiento",
        item: [
          {
            linkId: "5.1",
            text: "Consentimiento para procesamiento seguro",
            answer: [{ valueBoolean: formData.consentimiento }],
          },
        ],
      },
    ],
  };
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<ScreeningFormData>(initialFormData);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [step4Error, setStep4Error] = useState<string | null>(null);
  const [step5Error, setStep5Error] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);

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
      formData.pruebaCognitivaReciente === "Sí, y tengo el resultado" &&
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

  const handleNextFromStep1 = () => {
    if (!isStep1Valid()) {
      setStep1Error(
        "Revisa la edad (entre 1 y 119 años) y selecciona un sexo biológico."
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
        "Completa diagnóstico previo, al menos un síntoma y una respuesta sobre la prueba cognitiva (el puntaje, si lo indicas, debe estar entre 0 y 30)."
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
        "Completa antecedentes familiares, al menos una condición médica y al menos una medicación actual."
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
        "Completa participación en ensayos, antecedentes de ACV/convulsiones y al menos una opción en otros diagnósticos de demencia."
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
      setStep5Error("Debes aceptar el consentimiento para continuar.");
      return;
    }
    setStep5Error(null);

    const fhirPayload = buildFhirQuestionnaireResponse(formData);

    try {
      const response = await fetch(EVALUATE_ELIGIBILITY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fhirPayload),
      });

      const text = await response.text();
      console.log("evaluateEligibility status:", response.status);
      console.log("evaluateEligibility body:", text);
    } catch (error) {
      console.error("Error al llamar a evaluateEligibility:", error);
    }

    setSubmitted(true);
  };

  const getStepLabel = () => {
    switch (currentStep) {
      case 1:
        return "Datos básicos del paciente";
      case 2:
        return "Diagnóstico y síntomas";
      case 3:
        return "Historial clínico";
      case 4:
        return "Criterios de exclusión";
      case 5:
        return "Consentimiento y resumen";
      default:
        return "";
    }
  };

  if (submitted) {
    const fhirPayload = buildFhirQuestionnaireResponse(formData);
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
        <main className="w-full max-w-4xl">
          <header className="mb-8 text-center">
            <h1 className="text-2xl md:text-3xl font-semibold text-black">
              Privacy-First Clinical Screening with Confidential Compute
            </h1>
            <p className="mt-2 text-sm md:text-base text-black">
              Evaluación de elegibilidad para ensayos clínicos de Alzheimer, con foco en privacidad.
            </p>
            <p className="mt-1 text-xs md:text-sm text-black">Proof of Eligibility</p>
          </header>

          <section className="bg-white shadow-md rounded-xl border border-slate-100 p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-semibold text-black mb-2">
              Pre-screening completado
            </h2>
            <p className="text-sm md:text-base text-black mb-4">
              Tus datos se han registrado correctamente. En un entorno real, ahora serían cifrados y enviados a un enclave seguro (Oasis TEE) para evaluar tu elegibilidad de forma privada.
            </p>

            <div className="mt-4 text-sm text-black">
              <p className="font-medium mb-2">Resumen de tus respuestas clave:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <span className="font-semibold">Edad:</span> {formData.edad ?? "-"}
                </li>
                <li>
                  <span className="font-semibold">Diagnóstico previo:</span> {formData.diagnosticoPrevio || "-"}
                </li>
                <li>
                  <span className="font-semibold">Síntomas reportados:</span>{" "}
                  {formData.sintomas.length > 0 ? formData.sintomas.join(", ") : "-"}
                </li>
                <li>
                  <span className="font-semibold">Antecedentes familiares:</span>{" "}
                  {formData.antecedentesFamiliares || "-"}
                </li>
              </ul>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium mb-1 text-black">
                Ejemplo de payload JSON (FHIR QuestionnaireResponse)
              </p>
              <p className="text-xs text-black mb-2">
                Este JSON ilustra cómo podrían serializarse tus respuestas en un formato compatible con FHIR para ser cifrado y procesado en un enclave seguro.
              </p>
              <pre className="text-xs bg-slate-900 text-slate-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(fhirPayload, null, 2)}
              </pre>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <main className="w-full max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-semibold text-black">
            Privacy-First Clinical Screening with Confidential Compute
          </h1>
          <p className="mt-2 text-sm md:text-base text-black">
            Evaluación de elegibilidad para ensayos clínicos de Alzheimer, con foco en privacidad.
          </p>
          <p className="mt-1 text-xs md:text-sm text-black">Proof of Eligibility</p>
        </header>

        <section className="bg-white shadow-md rounded-xl border border-slate-100 p-6 md:p-8">
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-black mb-2">
              <span className="font-medium">Paso {currentStep} de 5</span>
              <span>{getStepLabel()}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-600 transition-all"
                style={{ width: `${(currentStep / 5) * 100}%` }}
              />
            </div>
          </div>

          {currentStep === 1 && (
            <>
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-black">
                    ¿Cuál es tu edad?
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={formData.edad ?? ""}
                    onChange={(e) => handleEdadChange(e.target.value)}
                    placeholder="Ej: 67"
                    className="mt-1 block text-black w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>

                <div className="border border-slate-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-black">
                    ¿Cuál es tu sexo biológico?
                  </label>
                  <select
                    value={formData.sexoBiologico}
                    onChange={(e) => handleSexoChange(e.target.value)}
                    className="mt-1 block text-black w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="">Selecciona una opción</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                  </select>
                </div>
              </div>

              {step1Error && (
                <p className="mt-3 text-xs text-red-600">{step1Error}</p>
              )}

              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={handleNextFromStep1}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="block text-sm font-medium text-black">
                    ¿Has recibido un diagnóstico previo de deterioro cognitivo leve (MCI) o
                    Alzheimer?
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-black">
                    {["Sí, Alzheimer", "Sí, Deterioro Cognitivo Leve", "No, pero presento síntomas", "No"].map(
                      (opt) => (
                        <label key={opt} className="flex items-center gap-2 text-black">
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

                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="block text-sm font-medium text-black">
                    En los últimos 6 meses, ¿experimentaste alguno de estos síntomas?
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-black">
                    {["Pérdida de memoria reciente", "Dificultad para concentrarte", "Dificultad para encontrar palabras", "Problemas para ejecutar tareas habituales", "Cambios en el estado de ánimo", "Ninguno de los anteriores"].map(
                      (opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-black"
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

                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="block text-sm font-medium text-black">
                    ¿Has realizado alguna prueba cognitiva recientemente (por ejemplo, MoCA o
                    MMSE)?
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-black">
                    {["Sí, y tengo el resultado", "Sí, pero no recuerdo el puntaje", "No"].map(
                      (opt) => (
                        <label key={opt} className="flex items-center gap-2 text-black">
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

                {formData.pruebaCognitivaReciente === "Sí, y tengo el resultado" && (
                  <div className="border border-slate-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-black">
                      Si lo recuerdas, ingresa tu puntaje MoCA o MMSE
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={formData.puntajePrueba ?? ""}
                      onChange={(e) => handlePuntajeChange(e.target.value)}
                      placeholder="Ej: 23"
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    />
                    <p className="mt-1 text-xs text-black">
                      Campo opcional. Si lo completas, el valor debe estar entre 0 y 30.
                    </p>
                  </div>
                )}
              </div>

              {step2Error && (
                <p className="mt-4 text-xs text-red-600">{step2Error}</p>
              )}

              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={handleNextFromStep2}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="block text-sm font-medium text-black">
                    ¿Tienes antecedentes familiares de Alzheimer?
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-black">
                    {["Sí, padre/madre", "Sí, abuelo/abuela", "No", "No lo sé"].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-black">
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

                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="block text-sm font-medium text-black">
                    ¿Tienes alguna de estas condiciones médicas?
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-black">
                    {["Hipertensión", "Diabetes tipo 2", "Enfermedad cardíaca", "Depresión mayor", "Ninguna"].map(
                      (opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-black"
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
                      )
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="block text-sm font-medium text-black">
                    ¿Estás tomando actualmente alguno de estos medicamentos?
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-black">
                    {[
                      "Inhibidores de colinesterasa (donepezilo, rivastigmina)",
                      "Memantina",
                      "Antipsicóticos",
                      "Antidepresivos",
                      "Ninguno",
                    ].map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-black"
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
                <p className="mt-4 text-xs text-red-600">{step3Error}</p>
              )}

              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={handleNextFromStep3}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </>
          )}

          {currentStep === 4 && (
            <>
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="block text-sm font-medium text-black">
                    ¿Has participado en otro ensayo clínico en los últimos 12 meses?
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-black">
                    {["Sí", "No"].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-black">
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

                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="block text-sm font-medium text-black">
                    ¿Tienes antecedentes de ACV o convulsiones?
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-black">
                    {["Sí", "No"].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-black">
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

                <div className="border border-slate-200 rounded-lg p-4">
                  <p className="block text-sm font-medium text-black">
                    ¿Posees un diagnóstico de demencia distinta a Alzheimer?
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-black">
                    {["Parkinson", "Demencia frontotemporal", "Demencia vascular", "No"].map(
                      (opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-black"
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
                <p className="mt-4 text-xs text-red-600">{step4Error}</p>
              )}

              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={handleNextFromStep4}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </>
          )}

          {currentStep === 5 && (
            <>
              <div className="space-y-4 text-black text-sm">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h2 className="font-semibold mb-2">Resumen de información clave</h2>
                  <dl className="space-y-1">
                    <div className="flex gap-2">
                      <dt className="font-medium w-32">Edad:</dt>
                      <dd>{formData.edad ?? "No informado"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium w-32">Diagnóstico previo:</dt>
                      <dd>{formData.diagnosticoPrevio || "No informado"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium w-32">Síntomas:</dt>
                      <dd>
                        {formData.sintomas.length > 0
                          ? formData.sintomas.join(", ")
                          : "No informado"}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="font-medium w-32">Antecedentes familiares:</dt>
                      <dd>{formData.antecedentesFamiliares || "No informado"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="font-semibold mb-1">Privacidad y procesamiento seguro</p>
                  <p>
                    Tus datos se convierten a un formato estructurado (compatible con FHIR), se
                    cifran en tu navegador y se procesan dentro de un enclave seguro
                    (confidential compute). Nadie del equipo ve tu información en texto plano.
                  </p>
                </div>

                <div>
                  <label className="flex items-start gap-2 text-sm text-black">
                    <input
                      type="checkbox"
                      checked={formData.consentimiento}
                      onChange={(e) => handleConsentimientoChange(e.target.checked)}
                      className="mt-0.5 text-sky-600"
                    />
                    <span>
                      Confirmo que autorizo el procesamiento seguro y cifrado de mis datos para
                      evaluar mi elegibilidad para este ensayo clínico.
                    </span>
                  </label>
                </div>
              </div>

              {step5Error && (
                <p className="mt-4 text-xs text-red-600">{step5Error}</p>
              )}

              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 transition-colors"
                >
                  Enviar
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
