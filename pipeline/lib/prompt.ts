export function buildEnrichmentPrompt(caseId: string): string {
  return `Eres un analista juridico forense experto en Derecho civil y procesal civil espanol. Te adjunto el texto completo de una sentencia del Tribunal Supremo de Espana. El texto contiene marcadores de pagina con el formato ===== PAGINA N ===== y N es el numero real de pagina del PDF.

Tu tarea: extraer toda la informacion relevante del caso y devolver UN SOLO objeto JSON valido. No uses herramientas, no leas ni escribas archivos, no expliques nada fuera del JSON. No uses bloques de codigo ni marcas \`\`\`.

CLAVES DEL JSON (exactamente estas 12):

"summary" objeto: "headline" frase corta del asunto; "summary" resumen objetivo de 4 a 8 frases (que ocurrio, quien demandaba a quien, resultado); "key_points" array de 3 a 8 puntos clave; "missing_information" array de datos que faltarian en el expediente (si no falta nada, []).

"parties" array con todas las partes (demandante, demandado, terceros). Cada una: "party_id" tipo PARTY-001; "name" nombre completo; "side" uno de PLAINTIFF, DEFENDANT, THIRD_PARTY, COURT, OTHER; "kind" uno de PERSON, COMPANY, PUBLIC_ENTITY, OTHER, UNKNOWN; "representation" procurador y director letrado o "UNKNOWN"; "is_consumer" YES, NO o UNKNOWN; "notes" observaciones o cadena vacia; "sources" array de {"page": N}.

"claims" pretensiones de cada parte. Cada una: "claim_id" tipo CLAIM-001; "claimant" quien la pide; "side" PLAINTIFF, DEFENDANT o UNKNOWN; "description" texto de la pretension; "outcome" uno de GRANTED, REJECTED, PARTIALLY_GRANTED, NOT_ANALYZED, UNKNOWN; "outcome_scope" uno de FINAL (fallo de esta resolucion), FIRST_INSTANCE, APPEAL, CASSATION, NONE; "sources".

"facts" hechos relevantes (entre 5 y 15). Cada uno: "fact_id" tipo FACT-001; "description"; "fact_type" FACTUAL, PROCEDURAL o JURIDICAL; "status" PROVEN, ALLEGED, DISPUTED o UNKNOWN; "asserted_by" quien lo afirma o "UNKNOWN"; "importance" 1 a 5; "sources".

"timeline" cronologia. Cada evento: "event_id" tipo EVT-001; "date" AAAA-MM-DD o "UNKNOWN"; "date_precision" DAY, MONTH, YEAR o UNKNOWN; "description"; "event_type" CONTRACT, PROCEDURAL, JUDGMENT, NOTIFICATION u OTHER; "sources".

"arguments" alegaciones de las partes y decisiones del tribunal. Cada una: "argument_id" tipo ARG-001; "side" PLAINTIFF, DEFENDANT, COURT u OTHER; "author" quien lo sostiene o "UNKNOWN"; "type" LEGAL, FACTUAL, PROCEDURAL o EVIDENTIARY; "description"; "legal_basis" normas citadas o "UNKNOWN"; "outcome" ACCEPTED, REJECTED, PARTIALLY_ACCEPTED, NOT_ANALYZED o UNKNOWN; "importance" 1 a 5; "sources".

"reasoning": frases y doctrinas clave del tribunal (ratio decidendi). ES LO MAS IMPORTANTE. Cada una: "holding_id" tipo HOLD-001; "statement" la frase o idea doctrinal; "is_literal_quote" true si es cita textual literal; "topic" tema corto (p.ej. actos propios, buena fe, causa); "legal_basis" precepto o "UNKNOWN"; "doctrine" doctrina o precedente citado o "UNKNOWN"; "importance" 1 a 5; "sources". Entre 5 y 15 entradas.

"cited_laws" leyes y articulos citados (incluye normativa bancaria, circulares, ordenanzas y normas de la UE). Cada cita: "citation_id" tipo LAW-001; "raw_text" el texto tal cual aparece (p.ej. "art. 1124 CC"); "norma" siglas o denominacion ("CC", "CCom", "LEC", "Ley 26/1988"...); "article" numero o "UNKNOWN"; "boe_id" solo si lo conoces con certeza (p.ej. BOE-A-1889-4763 para el Codigo Civil), si no "UNKNOWN"; "quote" cita textual breve o "UNKNOWN"; "relevance" APPLIED, CITED, DISCUSSED o UNKNOWN; "sources".

"cited_case_law" sentencias citadas. Cada una: "citation_id" tipo CASELAW-001; "ref" referencia tal cual ("STS 584/2008"); "date" AAAA-MM-DD o "UNKNOWN"; "ecli" solo si aparece explicito, si no "UNKNOWN"; "quote" cita textual o "UNKNOWN"; "role" DOCTRINE_APPLIED, DISTINGUISHED, CITED o UNKNOWN; "sources".

"outcome" RESULTADO (fundamental para analizar patrones de exito). "cassation_outcome" ESTIMED (se estima el recurso), DISMISSED (se desestima), PARTIALLY_ESTIMATED o UNKNOWN. "recurring_side" PLAINTIFF, DEFENDANT, BOTH, NONE o UNKNOWN (que lado era el recurrente en casacion). "decisions" array con el resultado de CADA instancia: {"instance": FIRST_INSTANCE, APPEAL, CASSATION u OTHER, "court", "date" AAAA-MM-DD o UNKNOWN, "result" FAVOR_PLAINTIFF, FAVOR_DEFENDANT, PARTIAL o UNKNOWN, "description", "sources"}. "claim_outcomes" array [{"claim_ref": "CLAIM-001", "outcome": GRANTED, REJECTED, PARTIALLY_GRANTED o UNKNOWN, "sources"}]. "reasoning_summary" por que decidio asi el tribunal, 1 a 3 frases.

"issues" problemas juridicos tratados. Cada uno: "issue_id" tipo ISS-001; "topic" etiqueta corta; "description"; "importance" 1 a 5; "sources".

"classification" objeto: "civil_branch" uno de CONTRACTUAL, CONSUMER_ABUSIVE_CLAUSES, LEASE_PROPERTY, CIVIL_LIABILITY, PROPERTY_COMMUNITY, FAMILY, SUCCESSIONS, COMMERCIAL, PROCEDURAL, OTHER; "subtopic" subtema concreto; "finality_status" FIRM, APPEALED_PENDING, REVOKED_ON_APPEAL o UNKNOWN.

REGLAS OBLIGATORIAS:
1. Responde SOLO con el JSON. Sin markdown, sin texto antes o despues, sin comentarios.
2. Toda entrada debe llevar "sources" con la pagina donde se apoya. Si no hay pagina concreta, array vacio [].
3. No inventes nada: si no consta en el documento, "UNKNOWN". Nunca inventes articulos, fechas, ECLI, numeros de recurso ni sentencias.
4. Los "statement" y "quote" deben ser fieles al documento. Si no es cita literal, marca is_literal_quote en false.
5. PLAINTIFF es quien demanda en primera instancia; DEFENDANT quien se defiende. En casacion, el recurrente suele ser el que perdio abajo.
6. "cassation_outcome" y los "decisions" salen del fallo y del articulo de estimacion/desestimacion de la sentencia.
7. Todos los textos libres en espanol. No incluyas la clave "case_id".
8. Si el documento no permite determinar algo, responde UNKNOWN en vez de suponer.

Caso a analizar: ${caseId}`;
}
