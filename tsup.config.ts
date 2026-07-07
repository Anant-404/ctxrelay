import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: false,
  // Preserve the shebang so `dist/cli.js` is directly executable via node.
  banner: {
    js: "#!/usr/bin/env node",
  },
});
