export type SexoBiologico = "Male" | "Female" | "Prefer not to say" | "";

export type DiagnosticoPrevio =
  | "Yes, Alzheimer's disease"
  | "Yes, Mild Cognitive Impairment (MCI)"
  | "No, but I have symptoms"
  | "No"
  | "";

export type PruebaCognitivaReciente =
  | "Yes, and I know the result"
  | "Yes, but I don't remember the score"
  | "No"
  | "";

export type AntecedentesFamiliares =
  | "Yes, parent"
  | "Yes, grandparent"
  | "No"
  | "I don't know"
  | "";

export type SiNo = "Yes" | "No" | "";

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
