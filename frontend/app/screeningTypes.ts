export type SexoBiologico = "Masculino" | "Femenino" | "Prefiero no decirlo" | "";

export type DiagnosticoPrevio =
  | "Sí, Alzheimer"
  | "Sí, Deterioro Cognitivo Leve"
  | "No, pero presento síntomas"
  | "No"
  | "";

export type PruebaCognitivaReciente =
  | "Sí, y tengo el resultado"
  | "Sí, pero no recuerdo el puntaje"
  | "No"
  | "";

export type AntecedentesFamiliares =
  | "Sí, padre/madre"
  | "Sí, abuelo/abuela"
  | "No"
  | "No lo sé"
  | "";

export type SiNo = "Sí" | "No" | "";

export interface ScreeningFormData {
  edad: number | null;
  sexoBiologico: SexoBiologico;
  diagnosticoPrevio: DiagnosticoPrevio;
  sintomas: string[];
  pruebaCognitivaReciente: PruebaCognitivaReciente;
  puntajePrueba?: number | null;
  antecedentesFamiliares: AntecedentesFamiliares;
  condicionesMedicas: string[];
  medicacionesActuales: string[];
  participacionEnsayos: SiNo;
  antecedentesACVConvulsiones: SiNo;
  otrasDemencias: string[];
  consentimiento: boolean;
}
