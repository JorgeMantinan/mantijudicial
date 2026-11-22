# Golden set — verificación mecánica (sprint_golden v1)

> Generado el 2026-11-22 por `pipeline/sprint_golden.ts` (propuesta).
> Criterio: sólo se confirman entradas con reglas de fallo, outcome.json y citas
> BOE concordantes con `judgment.txt`. La verificación jurídica profunda (leer el
> fallo y juzgar rama/citas) la hace el agente en el sprint:
> `.opencode/skills/golden-set/SKILL.md`.

## Resumen

- Casos: 80 · ALTA confirmadas: 78 · ALTA sin entrada (creadas): 0
- MEDIA (revisión profunda en el sprint): 0 · BAJA: 1 · sin entrada: 1 · sin texto: 0
- Ejecuta `pnpm exec tsx pipeline/sprint_golden.ts --aplicar` para confirmar las ALTA.

| caso | veredicto | expect | ia | reglas | citas | headline | nota |
|---|---|---|---|---|---|---|---|
| case_000001 | ALTA | DISMISSED | DISMISSED | DISMISSED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000002 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000003 | ALTA | DISMISSED | DISMISSED | DISMISSED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000004 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000005 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000006 | ALTA | DISMISSED | DISMISSED | DISMISSED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000007 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000008 | ALTA | DISMISSED | DISMISSED | DISMISSED | 6/6 | — | Reglas, IA y citas concordantes con el texto. |
| case_000009 | ALTA | ESTIMED | ESTIMED | ESTIMED | 1/1 | — | Reglas, IA y citas concordantes con el texto. |
| case_000010 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000011 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000012 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000013 | ALTA | ESTIMED | ESTIMED | ESTIMED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000014 | ALTA | DISMISSED | DISMISSED | DISMISSED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000015 | ALTA | PARTIALLY_ESTIMATED | PARTIALLY_ESTIMATED | PARTIALLY_ESTIMATED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000016 | ALTA | DISMISSED | DISMISSED | DISMISSED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000017 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000018 | ALTA | ESTIMED | ESTIMED | ESTIMED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000019 | ALTA | DISMISSED | DISMISSED | DISMISSED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000020 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000021 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000022 | ALTA | ESTIMED | ESTIMED | ESTIMED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000023 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000024 | ALTA | DISMISSED | DISMISSED | DISMISSED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000025 | ALTA | ESTIMED | ESTIMED | ESTIMED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000026 | ALTA | DISMISSED | DISMISSED | DISMISSED | 5/5 | — | Reglas, IA y citas concordantes con el texto. |
| case_000027 | ALTA | ESTIMED | ESTIMED | ESTIMED | 5/5 | — | Reglas, IA y citas concordantes con el texto. |
| case_000028 | ALTA | ESTIMED | ESTIMED | ESTIMED | 5/5 | — | Reglas, IA y citas concordantes con el texto. |
| case_000029 | ALTA | DISMISSED | DISMISSED | DISMISSED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000030 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000031 | ALTA | DISMISSED | DISMISSED | DISMISSED | 6/6 | — | Reglas, IA y citas concordantes con el texto. |
| case_000032 | BAJA | — | PARTIALLY_ESTIMATED | UNKNOWN | 4/4 | — | Las reglas no detectan fallo en el texto. |
| case_000033 | ALTA | DISMISSED | DISMISSED | DISMISSED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000034 | ALTA | ESTIMED | ESTIMED | ESTIMED | 1/1 | — | Reglas, IA y citas concordantes con el texto. |
| case_000035 | ALTA | ESTIMED | ESTIMED | ESTIMED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000036 | ALTA | DISMISSED | DISMISSED | DISMISSED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000037 | ALTA | ESTIMED | ESTIMED | ESTIMED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000038 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000039 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000040 | ALTA | ESTIMED | ESTIMED | ESTIMED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000041 | ALTA | DISMISSED | DISMISSED | DISMISSED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000042 | ALTA | ESTIMED | ESTIMED | ESTIMED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000043 | ALTA | DISMISSED | DISMISSED | DISMISSED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000044 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000045 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000046 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000047 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000048 | ALTA | DISMISSED | DISMISSED | DISMISSED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000049 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000050 | ALTA | DISMISSED | DISMISSED | DISMISSED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000051 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000052 | ALTA | DISMISSED | DISMISSED | DISMISSED | 6/6 | — | Reglas, IA y citas concordantes con el texto. |
| case_000053 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000054 | ALTA | ESTIMED | ESTIMED | ESTIMED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000055 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000056 | SIN-ENTRADA | — | SIN_OUTCOME | DISMISSED | — | — | Sin expect en golden.json. |
| case_000057 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000058 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000059 | ALTA | ESTIMED | ESTIMED | ESTIMED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000060 | ALTA | ESTIMED | ESTIMED | ESTIMED | 1/1 | — | Reglas, IA y citas concordantes con el texto. |
| case_000061 | ALTA | DISMISSED | DISMISSED | DISMISSED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000062 | ALTA | ESTIMED | ESTIMED | ESTIMED | 2/2 | — | Reglas, IA y citas concordantes con el texto. |
| case_000063 | ALTA | ESTIMED | ESTIMED | ESTIMED | 5/5 | — | Reglas, IA y citas concordantes con el texto. |
| case_000064 | ALTA | DISMISSED | DISMISSED | DISMISSED | 5/5 | — | Reglas, IA y citas concordantes con el texto. |
| case_000065 | ALTA | DISMISSED | DISMISSED | DISMISSED | 5/5 | — | Reglas, IA y citas concordantes con el texto. |
| case_000066 | ALTA | DISMISSED | DISMISSED | DISMISSED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000067 | ALTA | DISMISSED | DISMISSED | DISMISSED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000068 | ALTA | DISMISSED | DISMISSED | DISMISSED | 6/6 | — | Reglas, IA y citas concordantes con el texto. |
| case_000069 | ALTA | DISMISSED | DISMISSED | DISMISSED | 5/5 | — | Reglas, IA y citas concordantes con el texto. |
| case_000070 | ALTA | ESTIMED | ESTIMED | ESTIMED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000071 | ALTA | PARTIALLY_ESTIMATED | PARTIALLY_ESTIMATED | PARTIALLY_ESTIMATED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000072 | ALTA | DISMISSED | DISMISSED | DISMISSED | 6/6 | — | Reglas, IA y citas concordantes con el texto. |
| case_000073 | ALTA | ESTIMED | ESTIMED | ESTIMED | 5/5 | — | Reglas, IA y citas concordantes con el texto. |
| case_000074 | ALTA | ESTIMED | ESTIMED | ESTIMED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000075 | ALTA | ESTIMED | ESTIMED | ESTIMED | 1/1 | — | Reglas, IA y citas concordantes con el texto. |
| case_000076 | ALTA | PARTIALLY_ESTIMATED | PARTIALLY_ESTIMATED | PARTIALLY_ESTIMATED | 4/4 | — | Reglas, IA y citas concordantes con el texto. |
| case_000077 | ALTA | PARTIALLY_ESTIMATED | PARTIALLY_ESTIMATED | PARTIALLY_ESTIMATED | 5/5 | — | Reglas, IA y citas concordantes con el texto. |
| case_000078 | ALTA | DISMISSED | DISMISSED | DISMISSED | 5/5 | — | Reglas, IA y citas concordantes con el texto. |
| case_000079 | ALTA | ESTIMED | ESTIMED | ESTIMED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
| case_000080 | ALTA | ESTIMED | ESTIMED | ESTIMED | 3/3 | — | Reglas, IA y citas concordantes con el texto. |
