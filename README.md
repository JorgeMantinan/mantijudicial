# MantiJudicial

> **Plataforma jurídica de análisis de jurisprudencia y legislación** — pipeline de datos + motor de búsqueda + capa IA con auditoría de resultados.

**🎯 Estado:** en desarrollo (demo no comercial) · **🖥️ Despliegue:** blueprint de Render · **🗄️ Corpus:** rama `data` del repositorio

---

## Qué es

Plataforma para analizar jurisprudencia española y legislation: un **pipeline de datos** limpia, extrae, enriquece y conecta resoluciones con artículos de ley, y una **web** permite buscar casos similares con explicación de por qué son similares.

El problema que resuelve: encontrar jurisprudencia relevante para un caso concreto es, hoy, buscar manualmente en bases de datos con criterios dispersos. Aquí el corpus se preprocesa una vez (calidad, metadatos, proveniencia) y luego se consulta con búsqueda híbrida.

## Funcionalidades

| Área | Qué hace |
|---|---|
| 🔍 **Búsqueda híbrida** | Índice local sobre el corpus + búsqueda semántica, con filtros por tipo, órgano, fecha y otras facetas. |
| 🔎 **Casos similares con explicación** | Devuelve no solo resultados, sino *por qué* encajan (comparación de hechos, fundamentos y criterios). |
| 🔁 **Pipeline de datos** | 16 etapas en TypeScript: higiene → extracción → metadatos → enriquecimiento → leyes → matching → patrones → búsqueda → ingest → seed → evaluación → comparación → redacción de informes. |
| 🏛️ **Multi-tenant con permisos** | Tres niveles de visibilidad: `GLOBAL_PUBLIC`, `ORGANIZATION_PRIVATE`, `LAWYER_PRIVATE`. |
| 🛡️ **Auditoría IA** | Toda salida de IA queda registrada con proveniencia, grado de verificación y revisión humana. Modo *demo* sin datos reales. |
| 📚 **Modelo jurídico** | Distinción `Decision` vs `CaseOutcome`, firmeza de resoluciones, jerarquía judicial, testigos/peritos/eventos procedimentales. |
| 🧪 **Calidad** | *Golden dataset*, test set y benchmarks; esquemas **Zod** en cada frontera de datos; tipado estricto. |
| 🧩 **Abstracción de proveedores IA** | Compatible con cualquier endpoint OpenAI (OpenAI, OpenRouter, DeepSeek…) o binario local. Sin vendor lock-in. |

## Stack técnico

| Capa | Tecnología |
|---|---|
| Pipeline de datos | **Node.js + TypeScript** (tsx), **Zod** (validación), manifest versionado por corrida |
| Web | **Next.js + React + TypeScript** |
| Datos | **PostgreSQL (Supabase)** + corpus documental en el repo (rama `data`) |
| Búsqueda | Índice propio (`pipeline/lib/search`) + capa semántica |
| IA | Cliente HTTP compatible con OpenAI / binario local · sin claves en el repo |
| Testing | **Vitest** + `tsc --noEmit` (typecheck) |
| Despliegue | **Render** (blueprint con disco persistente, health check, secretos en panel) |
| Estructura | `pipeline/` (etapas) · `apps/web/` · `docs/` (14 documentos de diseño) · `cases/`, `laws/`, `data/` |

## Arquitectura

```
cases/  laws/  data/            ┌──────────────────────────────┐
 (rama `data`) ────► pipeline ──┤ 01 hygiene ─► 02 extract     │
                                │ 03 metadata ─► 04 enrich     │
                                │ 05 laws ─► 06 match          │
                                │ 07 patterns ─► 08 search     │
                                │ … ─► 15 escrito / 12 eval    │
                                └──────────────┬───────────────┘
                                               │ índices + metadatos
                                        ┌──────┴───────┐
                                        │  Supabase    │
                                        └──────┬───────┘
                                        ┌──────┴───────┐
                                        │  Next.js web │──► IA (proveniencia + auditoría)
                                        └──────────────┘
```

**Decisiones de diseño:**
- *Corpus fuera de `main`*: los datos (resoluciones, leyes) viven en la rama `data`; `main` solo contiene código. El despliegue los copia al disco persistente en el arranque.
- *Proveniencia obligatoria*: cada campo generado por IA guarda fuente, método y estado de verificación — sin "confianza ciega" en el modelo.
- *Validación Zod en cada etapa*: una resolución corrupta se detecta en la etapa 01, no en la búsqueda.
- *IA intercambiable*: `AI_PROVIDER`/`AI_BASE_URL`/`AI_MODEL` permiten cambiar de modelo sin tocar código.

## Documentación de diseño

`docs/` contiene el diseño completo (arquitectura, modelo de datos, permisos, arquitectura IA, seguridad, UI/UX, plan de implementación, problemas y límites, despliegue). Es material de lectura útil para entender cómo se documenta un proyecto de este tamaño.

## Cómo se construyó

Diseño, arquitectura, implementación y despliegue por **Jorge Mantiñán Montero**, con IA como acelerador. Decisiones de modelado jurídico, permisos y auditoría: propias.

## Puesta en marcha

```bash
pnpm install
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest
pnpm hygiene        # etapa 01 del pipeline (y así sucesivamente)
pnpm web            # apps/web → Next.js en local
```

## Licencia

Código visible bajo **[PolyForm Noncommercial 1.0.0](LICENSE)**: puedes verlo, clonarlo, estudiarlo y
usarlo para fines personales, de aprendizaje o de investigación. **Cualquier uso comercial requiere mi
autorización expresa.** El corpus de jurisprudencia NO está incluido en este repositorio.

© 2026 Jorge Mantiñán Montero — contacto a través de [LinkedIn](https://www.linkedin.com/in/jorge-manti%C3%B1%C3%A1n-montero/).

---

<p align="center"><sub>Proyecto personal · España · 2026 · Fase de demostración no comercial. Los análisis son orientativos y no constituyen asesoramiento jurídico.</sub></p>
