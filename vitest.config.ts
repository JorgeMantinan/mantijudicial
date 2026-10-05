import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["pipeline/**/*.test.ts", "apps/web/lib/**/*.test.ts"],
    environment: "node",
  },
});
