import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "examples", "test", "**/*.config.ts", "scripts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      // tsc (noUnusedLocals) already covers unused vars; avoid double-reporting.
      "@typescript-eslint/no-unused-vars": "off",
      // The parser layer deliberately uses `any` around the WASM runtime.
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  }
);
