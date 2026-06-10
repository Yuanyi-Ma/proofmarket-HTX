import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next.js compiles JSX with the automatic runtime (no `import React`);
  // mirror that so app components (e.g. app/page.tsx) load under vitest.
  esbuild: { jsx: "automatic" }
});
