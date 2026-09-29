import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // The "@/..." project-root alias from jsconfig.json (used by hooks/components)
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
  test: {
    environment: "jsdom",
  },
});
