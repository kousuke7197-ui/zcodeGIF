const js = require("@eslint/js");

/**
 * ESLint 配置（legacy config 格式，对应 ESLint v8）
 *
 * 项目包含两类 JavaScript 文件：
 *   1. 网页 / Electron 渲染进程文件（app.js、desktop/control.js、desktop/overlay.js）
 *      —— 使用 IIFE 模式，运行在浏览器环境。
 *   2. Electron 主进程 / preload 文件（desktop/main.js、desktop/preload.js、desktop/logger.js）
 *      —— 使用 CommonJS（require / module.exports），运行在 Node 环境。
 *
 * 通过 overrides 分别为两类文件设置不同的 env。
 *
 * @type {import("eslint").Linter.Config}
 */
module.exports = {
  root: true,
  env: {
    es2021: true
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "script"
  },
  rules: {
    // 以 @eslint/js recommended 规则作为基础
    ...js.configs.recommended.rules,
    // 未使用变量降级为警告
    "no-unused-vars": "warn",
    // console 调用为警告，但允许 console.warn
    "no-console": ["warn", { allow: ["warn"] }]
  },
  overrides: [
    {
      // 网页版 (app.js) 与桌面渲染进程 (control.js / overlay.js)：浏览器环境
      files: ["app.js", "desktop/control.js", "desktop/overlay.js"],
      env: {
        browser: true,
        es2021: true
      },
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "script"
      }
    },
    {
      // Electron 主进程 (main.js) / preload (preload.js) / 日志 (logger.js)
      // 运行在 Node 环境，使用 CommonJS 模块规范
      files: ["desktop/main.js", "desktop/preload.js", "desktop/logger.js"],
      env: {
        node: true,
        commonjs: true,
        es2021: true
      },
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "script"
      }
    }
  ]
};
