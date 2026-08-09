"use strict";

/* eslint-disable no-console -- 日志模块的核心职责就是包装 console 方法 */

/**
 * 简易日志模块
 *
 * - 同时输出到控制台和 userData 目录下的 app.log 文件
 * - 日志文件超过 1MB 时自动轮转，仅保留最后 500KB
 * - 提供 info / warn / error 三个方法
 */

const fs = require("fs");
const path = require("path");

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const ROTATE_KEEP_SIZE = 512 * 1024; // 500KB

let logFilePath = null;
let initialized = false;

/**
 * 初始化日志文件路径（需要在 app ready 之后调用，因为依赖 app.getPath）。
 * @param {string} userDataDir - app.getPath("userData") 返回的目录
 */
function init(userDataDir) {
  if (initialized) return;
  logFilePath = path.join(userDataDir, "app.log");
  initialized = true;
}

/**
 * 获取日志文件路径，未初始化时返回 null。
 * @returns {string|null}
 */
function getLogFilePath() {
  return logFilePath;
}

/**
 * 当日志文件超过 MAX_FILE_SIZE 时，截断保留尾部 ROTATE_KEEP_SIZE 字节。
 */
function rotateIfNeeded() {
  if (!logFilePath) return;
  try {
    const stat = fs.statSync(logFilePath);
    if (stat.size <= MAX_FILE_SIZE) return;

    // 读取文件尾部并重写，实现轮转
    const fd = fs.openSync(logFilePath, "r");
    const buffer = Buffer.alloc(ROTATE_KEEP_SIZE);
    const start = stat.size - ROTATE_KEEP_SIZE;
    fs.readSync(fd, buffer, 0, ROTATE_KEEP_SIZE, start);
    fs.closeSync(fd);
    fs.writeFileSync(logFilePath, buffer);
  } catch (_) {
    // 轮转失败不影响主流程
  }
}

/**
 * 格式化日志行。
 * @param {string} level
 * @param {unknown[]} args
 * @returns {string}
 */
function formatLine(level, args) {
  const timestamp = new Date().toISOString();
  const text = args
    .map((arg) => {
      if (arg instanceof Error) {
        return arg.stack || arg.message;
      }
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch (_) {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");
  return `[${timestamp}] [${level.toUpperCase()}] ${text}\n`;
}

/**
 * 写入日志到文件。
 * @param {string} level
 * @param {unknown[]} args
 */
function writeToFile(level, args) {
  if (!logFilePath) return;
  const line = formatLine(level, args);
  try {
    fs.appendFileSync(logFilePath, line, "utf8");
    rotateIfNeeded();
  } catch (_) {
    // 文件写入失败时忽略，避免影响主流程
  }
}

/**
 * 创建日志方法。
 * @param {string} level
 * @param {Function} consoleFn
 * @returns {(...args: unknown[]) => void}
 */
function createMethod(level, consoleFn) {
  return function (...args) {
    // 输出到控制台
    consoleFn(...args);
    // 写入文件
    writeToFile(level, args);
  };
}

module.exports = {
  init,
  getLogFilePath,
  info: createMethod("info", console.log),
  warn: createMethod("warn", console.warn),
  error: createMethod("error", console.error)
};
