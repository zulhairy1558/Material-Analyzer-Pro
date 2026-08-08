import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const _dirname = dirname(__filename);
void _dirname;
void __filename;

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules — enforced as errors
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/ban-ts-comment": "error",
    "@typescript-eslint/prefer-as-const": "off",

    // React rules — enforced as errors
    "react-hooks/exhaustive-deps": "error",
    "react-hooks/purity": "off", // shadcn ui sidebar uses Math.random in useMemo; leave off until upstream fix
    "react/no-unescaped-entities": "error",
    "react/display-name": "error",
    "react/prop-types": "off",

    // Next.js rules
    "@next/next/no-img-element": "off", // we use img in PDF preview; next/image not suitable for blob URLs
    "@next/next/no-html-link-for-pages": "error",

    // General JavaScript rules — enforced as errors
    // Note: no-undef is disabled because TypeScript already enforces this via the compiler.
    "no-undef": "off",
    "prefer-const": "error",
    "no-unused-vars": "off", // handled by @typescript-eslint/no-unused-vars
    "no-console": "error",
    "no-debugger": "error",
    "no-empty": "error",
    "no-irregular-whitespace": "error",
    "no-case-declarations": "error",
    "no-fallthrough": "error",
    "no-mixed-spaces-and-tabs": "error",
    "no-redeclare": "error",
    "no-unreachable": "error",
    "no-useless-escape": "error",
  },
}, {
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "examples/**",
    "skills",
    "skills-extracted/**",
    "upload/**",
    "tool-results/**",
    "scripts/**",
    "tests/**",
    ".zscripts/**",
    "radar-source/**",
  ],
}];

export default eslintConfig;
