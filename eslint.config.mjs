import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["apps/api/**/*.ts", "packages/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
  { files: ["**/*.tsx"], rules: { "react-hooks/set-state-in-effect": "off" } },
  // React Compiler is not enabled; TanStack Table deliberately returns a mutable API.
  {
    files: [
      "apps/web/src/components/catalog-page.tsx",
      "apps/web/src/components/report-invoices.tsx",
      "apps/web/src/components/employees-page.tsx",
    ],
    rules: { "react-hooks/incompatible-library": "off" },
  },
  { settings: { next: { rootDir: "apps/web/" } } },
  ...tseslint.configs.recommended,
  globalIgnores([
    "**/.next/**",
    "**/dist/**",
    ".npm-cache/**",
    ".local/**",
    "artifacts/**",
    "**/next-env.d.ts",
  ]),
]);
