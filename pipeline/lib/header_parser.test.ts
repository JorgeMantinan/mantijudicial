import { describe, expect, it } from "vitest";
import { parseCaseHeader, toIsoDate } from "./header_parser.js";

const SAMPLE = `JURISPRUDENCIA
Roj: STS 3706/2026 - ECLI:ES:TS:2026:3706
Id Cendoj: 28079110012026101405
Órgano: Tribunal Supremo. Sala de lo Civil
Sede: Madrid
Sección: 1
Fecha: 16/09/2026
Nº de Recurso: 6484/2023
Nº de Resolución: 1438/2026
Procedimiento: Recurso de casación
Ponente: RAFAEL SARAZÁ JIMENA
Tipo de Resolución: Sentencia
Fecha de sentencia: 16/09/2026
Tipo de procedimiento: CASACIÓN
Fecha de Votación y Fallo: 09/09/2026
Ponente: Excmo. Sr. D. Rafael Sarazá Jimena
Procedencia: Audiencia Provincial de Madrid, Sección 28.ª
`;

describe("toIsoDate", () => {
  it("convierte dd/mm/yyyy a ISO", () => {
    expect(toIsoDate("16/09/2026")).toBe("2026-09-16");
    expect(toIsoDate("01/01/2026")).toBe("2026-01-01");
  });

  it("devuelve null con formato invalido", () => {
    expect(toIsoDate("2026-09-16")).toBeNull();
    expect(toIsoDate("16/09")).toBeNull();
  });
});

describe("parseCaseHeader", () => {
  it("extrae todos los campos de la cabecera CENDOJ", () => {
    const header = parseCaseHeader(SAMPLE);
    expect(header.id_cendoj).toBe("28079110012026101405");
    expect(header.court).toBe("Tribunal Supremo. Sala de lo Civil");
    expect(header.seat).toBe("Madrid");
    expect(header.section).toBe("1");
    expect(header.resolution_date).toBe("2026-09-16");
    expect(header.appeal_number).toBe("6484/2023");
    expect(header.resolution_number).toBe("1438/2026");
    expect(header.procedure_type).toBe("Recurso de casación");
    expect(header.procedencia).toBe("Audiencia Provincial de Madrid, Sección 28.ª");
    expect(header.date_vote_and_fall).toBe("2026-09-09");
  });

  it("usa la ultima aparicion de Ponente y limpia el rango", () => {
    const header = parseCaseHeader(SAMPLE);
    expect(header.rapporteur).toBe("Rafael Sarazá Jimena");
  });

  it("devuelve objeto parcial sin campos inexistentes", () => {
    const header = parseCaseHeader("texto sin cabecera");
    expect(Object.keys(header)).toHaveLength(0);
  });
});
