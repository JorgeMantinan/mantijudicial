import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface AIRunOptions {
  prompt: string;
  files?: string[];
  model: string;
  timeoutMs?: number;
  cwd?: string;
}

export interface AIRunResult {
  text: string;
  tokens: { input: number; output: number; total: number } | null;
  cost: number | null;
  sessionID: string | null;
}

export interface AIProvider {
  readonly name: string;
  run(options: AIRunOptions): Promise<AIRunResult>;
}

interface JsonEvent {
  type?: string;
  sessionID?: string;
  part?: {
    type?: string;
    text?: string;
    tokens?: { input?: number; output?: number; total?: number };
    cost?: number;
  };
}

function resolveOpenCodeBinary(): string {
  const explicit = process.env.OPENCODE_BIN;
  if (explicit && fs.existsSync(explicit)) return explicit;
  const appData = process.env.APPDATA;
  if (appData) {
    const candidate = path.join(appData, "npm", "node_modules", "opencode-ai", "bin", "opencode.exe");
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    "No se ha encontrado el binario de opencode. Define la variable OPENCODE_BIN con su ruta.",
  );
}

export class OpencodeCliProvider implements AIProvider {
  readonly name = "opencode-cli";

  async run(options: AIRunOptions): Promise<AIRunResult> {
    const binary = resolveOpenCodeBinary();
    const timeoutMs = options.timeoutMs ?? 600_000;
    const args = ["run", options.prompt, "--format", "json", "--model", options.model];
    for (const file of options.files ?? []) args.push("--file", file);

    return await new Promise<AIRunResult>((resolve, reject) => {
      const child = spawn(binary, args, {
        cwd: options.cwd ?? process.cwd(),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(new Error(`Timeout tras ${timeoutMs}ms. Salida: ${stdout.slice(-1500)}`));
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          reject(
            new Error(
              `opencode exito con codigo ${code}. stderr: ${stderr.slice(-1000)} stdout: ${stdout.slice(-1500)}`,
            ),
          );
          return;
        }
        try {
          resolve(parseRunEvents(stdout));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
  }
}

/** Configuración del proveedor HTTP compatible con OpenAI (o cualquier clon). */
export interface HttpProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

export function readHttpConfig(model: string): HttpProviderConfig | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  return {
    apiKey,
    baseUrl,
    model: process.env.AI_MODEL?.trim() || model,
    temperature: 0.2,
  };
}

export function buildChatBody(prompt: string, fileTexts: string[], config: HttpProviderConfig): unknown {
  const contexto = fileTexts.length > 0 ? `\n\n## CONTEXTO\n${fileTexts.join("\n\n---\n\n")}` : "";
  return {
    model: config.model,
    temperature: config.temperature,
    messages: [
      { role: "system", content: "Eres un asistente jurídico que responde SIEMPRE con el JSON exacto que se pide." },
      { role: "user", content: `${prompt}${contexto}` },
    ],
  };
}

export function parseChatResponse(payload: unknown): AIRunResult {
  const data = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content.trim()
      : Array.isArray(content)
        ? content
            .map((part) => (typeof part?.text === "string" ? part.text : ""))
            .join("")
            .trim()
        : "";
  if (text.length === 0) throw new Error("El proveedor HTTP no devolvió texto del modelo");
  const input = data.usage?.prompt_tokens ?? 0;
  const output = data.usage?.completion_tokens ?? 0;
  const total = data.usage?.total_tokens ?? input + output;
  return {
    text,
    tokens: total > 0 || input > 0 || output > 0 ? { input, output, total } : null,
    cost: null,
    sessionID: null,
  };
}

export class HttpAiProvider implements AIProvider {
  readonly name = "http-openai";

  async run(options: AIRunOptions): Promise<AIRunResult> {
    const config = readHttpConfig(options.model);
    if (!config) {
      throw new Error(
        "No hay clave de IA. Define AI_API_KEY (y opcionalmente AI_BASE_URL y AI_MODEL), o instala opencode.",
      );
    }
    const fileTexts = (options.files ?? []).map((file) => fs.readFileSync(file, "utf8"));
    const body = buildChatBody(options.prompt, fileTexts, config);
    const timeoutMs = options.timeoutMs ?? 600_000;

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 600);
      throw new Error(`Proveedor HTTP ${response.status}: ${detail}`);
    }
    return parseChatResponse(await response.json());
  }
}

/**
 * Proveedor de IA activo: HTTP si hay `AI_API_KEY` (o `AI_PROVIDER=http`),
 * opencode en local en caso contrario.
 */
export function createAIProvider(): AIProvider {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === "http" || forced === "openai") return new HttpAiProvider();
  if (forced === "opencode") return new OpencodeCliProvider();
  if (process.env.AI_API_KEY?.trim()) return new HttpAiProvider();
  return new OpencodeCliProvider();
}

export function parseRunEvents(stdout: string): AIRunResult {
  const textParts: string[] = [];
  let input = 0;
  let output = 0;
  let total = 0;
  let cost: number | null = null;
  let sessionID: string | null = null;

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    let event: JsonEvent;
    try {
      event = JSON.parse(trimmed) as JsonEvent;
    } catch {
      continue;
    }
    if (event.sessionID) sessionID = event.sessionID;
    const part = event.part;
    if (!part) continue;
    if (event.type === "text" && typeof part.text === "string") {
      textParts.push(part.text);
    }
    if (part.tokens) {
      input += part.tokens.input ?? 0;
      output += part.tokens.output ?? 0;
      total += part.tokens.total ?? 0;
    }
    if (typeof part.cost === "number") cost = (cost ?? 0) + part.cost;
  }

  const text = textParts.join("\n").trim();
  if (text.length === 0) {
    throw new Error(`No se ha recibido texto del modelo. Salida: ${stdout.slice(-1500)}`);
  }

  return {
    text,
    tokens: total > 0 || input > 0 || output > 0 ? { input, output, total } : null,
    cost,
    sessionID,
  };
}
