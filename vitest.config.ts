import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const raiz = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["pipeline/**/*.test.ts", "apps/web/lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    // Mismo alias que apps/web/tsconfig.json: los tests de apps/web/lib
    // importan módulos que a su vez traen código de @pipeline. (Solo este:
    // un alias "@" reescribiría también los imports con ámbito @algo.)
    alias: {
      "@pipeline": path.join(raiz, "pipeline", "lib"),
    },
  },
});
