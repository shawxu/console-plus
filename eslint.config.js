import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "archive/**", "node_modules/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: { globals: { console: "readonly" } },
  },
  {
    // 浏览器集成页与本地预览脚本由各自运行时提供全局，不参与 TS 类型检查
    files: ["tests/browser/**/*.js", "scripts/**/*.mjs"],
    rules: { "no-undef": "off" },
  },
  {
    files: ["**/*.ts"],
    rules: {
      "no-undef": "off",
      "no-console": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
