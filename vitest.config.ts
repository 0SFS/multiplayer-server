import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    conditions: ["source", "import", "module", "default"],
    alias: [
      { find: /^@0sfs\/multiplayer\/(.*)$/, replacement: path.join(root, "../multiplayer/src/$1.ts") },
      { find: /^@0sfs\/anti-cheat\/(.*)$/, replacement: path.join(root, "../anti-cheat/src/$1.ts") },
    ],
  },
  test: { include: ["tests/**/*.test.ts"] },
});
