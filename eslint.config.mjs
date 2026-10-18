// 临时自检配置：与 Obsidian 插件目录审核器规则对齐
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: "module",
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      obsidianmd,
    },
    rules: {
      "obsidianmd/no-unsupported-api": "error",
      "obsidianmd/validate-manifest": "error",
      "obsidianmd/validate-license": "error",
      "obsidianmd/prefer-create-el": "warn",
      "obsidianmd/detach-leaves": "error",
      "obsidianmd/hardcoded-config-path": "error",
      "obsidianmd/no-static-styles-assignment": "error",
      "obsidianmd/sample-names": "error",
      "obsidianmd/no-sample-code": "error",
      "obsidianmd/no-global-this": "error",
      "obsidianmd/no-nodejs-modules": "error",
      "obsidianmd/platform": "error",
      "obsidianmd/regex-lookbehind": "error",
      "obsidianmd/prefer-instanceof": "error",
      "obsidianmd/prefer-window-timers": "error",
      "obsidianmd/prefer-active-doc": "error",
      "obsidianmd/vault/iterate": "error",
      "obsidianmd/commands/no-default-hotkeys": "error",
      "obsidianmd/commands/no-plugin-id-in-command-id": "error",
      "obsidianmd/commands/no-plugin-name-in-command-name": "error",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/unbound-method": "warn",
    },
  },
  {
    files: ["manifest.json"],
    plugins: { obsidianmd },
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      "obsidianmd/validate-manifest": "error",
    },
  },
];
