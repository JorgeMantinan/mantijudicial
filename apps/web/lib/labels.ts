/**
 * Etiquetas en castellano para los valores que viajan en JSON.
 * El dato crudo se conserva en el modelo; esto es solo presentación.
 */

export const BRANCH: Record<string, string> = {
  CONTRACTUAL: "Contractual",
  CONSUMER_ABUSIVE_CLAUSES: "Cláusulas abusivas (consumo)",
  LEASE_PROPERTY: "Arrendamiento",
  CIVIL_LIABILITY: "Responsabilidad civil",
  PROPERTY_COMMUNITY: "Propiedad horizontal",
  COMMERCIAL: "Mercantil",
  PROCEDURAL: "Procesal",
  FAMILY: "Familia",
  SUCCESSIONS: "Sucesiones",
  OTHER: "Otro",
  UNKNOWN: "Sin clasificar",
};

export const OUTCOME: Record<string, string> = {
  ESTIMED: "Estimado",
  DISMISSED: "Desestimado",
  PARTIALLY_ESTIMATED: "Parcialmente estimado",
  UNKNOWN: "Sin dato",
};

/** Lado de una parte o de un recurrente. */
export const SIDE: Record<string, string> = {
  PLAINTIFF: "Demandante",
  DEFENDANT: "Demandado",
  THIRD_PARTY: "Tercero",
  COURT: "Tribunal",
  OTHER: "Otro",
  UNKNOWN: "Sin dato",
  BOTH: "Ambas partes",
  NONE: "Ninguno",
};

/** Resultado por instancia en el fallo. */
export const RESULT: Record<string, string> = {
  FAVOR_PLAINTIFF: "A favor del demandante",
  FAVOR_DEFENDANT: "A favor del demandado",
  PARTIAL: "Parcial",
  UNKNOWN: "Sin dato",
};

export const INSTANCE: Record<string, string> = {
  FIRST_INSTANCE: "Primera instancia",
  APPEAL: "Apelación",
  CASSATION: "Casación",
  OTHER: "Otra",
};

export const YESNO: Record<string, string> = {
  YES: "Sí",
  NO: "No",
  UNKNOWN: "Sin dato",
};

export const KIND: Record<string, string> = {
  PERSON: "Persona física",
  COMPANY: "Sociedad",
  PUBLIC_ENTITY: "Entidad pública",
  OTHER: "Otro",
  UNKNOWN: "Sin dato",
};

export const CLAIM_OUTCOME: Record<string, string> = {
  GRANTED: "Estimada",
  REJECTED: "Desestimada",
  PARTIALLY_ESTIMATED: "Parcialmente estimada",
  PARTIALLY_GRANTED: "Parcialmente estimada",
  NOT_ANALYZED: "No analizada",
  UNKNOWN: "Sin dato",
};

export const SCOPE: Record<string, string> = {
  FINAL: "Fallo de esta resolución",
  FIRST_INSTANCE: "Primera instancia",
  APPEAL: "Apelación",
  CASSATION: "Casación",
  NONE: "Ninguno",
};

export const ESCRITO_TIPO: Record<string, string> = {
  RECURSO_CASACION: "Recurso de casación",
  ALEGACIONES: "Alegaciones",
  OPOSICION: "Oposición",
};

export const FACT_TYPE: Record<string, string> = {
  FACTUAL: "Hecho",
  PROCEDURAL: "Procesal",
  JURIDICAL: "Jurídico",
};

export const FACT_STATUS: Record<string, string> = {
  PROVEN: "Probado",
  ALLEGED: "Alegado",
  DISPUTED: "Controvertido",
  UNKNOWN: "Sin dato",
};

export const ARG_TYPE: Record<string, string> = {
  LEGAL: "Jurídico",
  PROCEDURAL: "Procesal",
  FACTUAL: "Fáctico",
  EVIDENTIARY: "Prueba",
};

export const ARG_OUTCOME: Record<string, string> = {
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
  PARTIALLY_ACCEPTED: "Parcialmente aceptado",
  NOT_ANALYZED: "No analizado",
  UNKNOWN: "Sin dato",
};

export const EVENT: Record<string, string> = {
  CONTRACT: "Contrato",
  PROCEDURAL: "Procesal",
  JUDGMENT: "Resolución",
  NOTIFICATION: "Notificación",
  OTHER: "Otro",
};

export const LAW_STATUS: Record<string, string> = {
  VERIFIED: "Verificada",
  PARTIAL: "Verificada en parte",
  TEXT_MISSING: "Sin texto en el BOE cargado",
  NON_BOE: "No es norma del BOE",
  UNKNOWN_NORM: "Sin resolver",
  AI_ID_UNVERIFIED: "Identificador no confirmado",
  NO_ARTICLE: "Sin artículo concreto",
  ARTICLE_NOT_FOUND: "El artículo no existe en la norma",
};

export const QUOTE: Record<string, string> = {
  MATCH: "Cita literal encontrada",
  MISMATCH: "No aparece literalmente",
  NOT_CHECKED: "Sin comprobar",
};

export const AUDIT: Record<string, string> = {
  "auth.login": "Inicio de sesión",
  "auth.login_failed": "Inicio de sesión fallido",
  "share.grant": "Permiso concedido",
  "share.revoke": "Permiso revocado",
  "user.create": "Usuario creado",
  "user.mfa_enabled": "Doble factor activado",
  "note.create": "Nota creada",
  "note.delete": "Nota eliminada",
  "golden.confirm": "Golden confirmado",
  "review.update": "Revisión guardada",
  "case.ingest": "Caso subido",
  "case.archived": "Caso archivado",
  "case.restored": "Caso restaurado",
};

export const REVIEW: Record<string, string> = {
  UNREVIEWED: "Sin revisar",
  REVIEWED: "Revisado",
  MODIFIED: "Revisado y modificado",
  REJECTED: "Rechazado",
};

export const ROLE: Record<string, string> = {
  ORG_ADMIN: "Administración",
  LAWYER: "Abogado/a",
  PARALEGAL: "Auxiliar",
  VIEWER: "Solo lectura",
  PLATFORM_ADMIN: "Administración de plataforma",
};

export const ACTION: Record<string, string> = {
  VIEW: "Ver",
  EDIT: "Editar",
  DOWNLOAD: "Descargar",
  SHARE: "Compartir",
  ANALYZE: "Analizar",
  DELETE: "Eliminar",
  EXPORT: "Exportar",
  CREATE: "Crear",
};

export const FORCE: Record<string, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

export const JOB: Record<string, string> = {
  queued: "en cola",
  running: "procesando",
  done: "completado",
  error: "error",
};

export const BLOCK_TIPO: Record<string, string> = {
  precepto: "Artículo",
  encabezado: "Encabezado",
  Encabezado: "Encabezado",
  firma: "Firma",
  preambulo: "Preámbulo",
  nota_inicial: "Nota",
  parte_dispositiva: "Parte dispositiva",
  Cabecera: "Cabecera",
};

export const SEARCH_KIND: Record<string, string> = {
  case: "Caso",
  holding: "Frase del tribunal",
  article: "Artículo legal",
};

export function label(map: Record<string, string>, value: string | undefined | null): string {
  if (!value) return "Sin dato";
  return map[value] ?? map[value.toUpperCase()] ?? value;
}
