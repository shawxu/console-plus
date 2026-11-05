import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "reporters/http": "src/reporters/http.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    target: "es2022",
    outDir: "dist",
  },
  {
    entry: { "console-plus": "src/browser.ts" },
    format: ["iife"],
    globalName: "ConsolePlus",
    minify: true,
    clean: false,
    dts: false,
    target: "es2022",
    outDir: "dist",
  },
]);
