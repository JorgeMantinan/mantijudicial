import { JobRegistry } from "@pipeline/jobs";

/** Registro compartido de trabajos largos (ingesta, reanálisis…). */
export const jobs = new JobRegistry();
