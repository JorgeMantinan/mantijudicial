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
