// 从 electron 包中引入核心模块
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  systemPreferences,
  desktopCapturer,
} from "electron";
import { createRequire } from "node:module"; // 用于在 ESModule 中使用 require
import { fileURLToPath } from "node:url"; // 将 import.meta.url 转换为文件路径
import fs from "node:fs";
import path from "node:path"; // 处理路径
import os from "node:os"; // 获取操作系统信息
// 引入 electron-util 用于打开系统设置等
import { openSystemPreferences } from "electron-util";

const IS_OSX = process.platform === "darwin";

// 在 ESModule 环境中创建 require 函数
const require = createRequire(import.meta.url);
// 获取当前文件所在的目录路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
  项目构建后的目录结构
  ├─ dist-electron       # 主进程 & preload 脚本
  │  ├─ main/index.js    # Electron 主进程入口
  │  └─ preload/index.mjs # 预加载脚本
  ├─ dist                # 渲染进程（Vite 构建产物）
  │  └─ index.html
*/

// APP_ROOT：项目根路径
process.env.APP_ROOT = path.join(__dirname, "../..");

// 主进程构建产物路径
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
// 渲染进程构建产物路径
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
// Vite 开发模式的服务器地址（开发环境才有）
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// 静态资源路径（开发模式：public；生产模式：dist）
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// 如果是 Windows 7（版本号 6.1），禁用 GPU 加速（兼容性问题）
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

// 为 Windows 10+ 系统设置应用名称（系统通知用）
if (process.platform === "win32") app.setAppUserModelId(app.getName());

// 保证应用只运行一个实例，如果检测到有第二个实例，直接退出
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win: BrowserWindow | null = null;
// 预加载脚本路径
const preload = path.join(__dirname, "../preload/index.mjs");
// 生产模式下的 HTML 文件路径
const indexHtml = path.join(RENDERER_DIST, "index.html");

// 创建主窗口
async function createWindow() {
  win = new BrowserWindow({
    title: "Main window", // 窗口标题
    icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"), // 窗口图标
    width: 800, // 宽度，单位 px
    height: 600, // 高度，单位 px
    webPreferences: {
      preload, // 预加载脚本
      // nodeIntegration: true, //（不安全）是否开启 Node.js API
      // contextIsolation: false, //（不安全）是否关闭上下文隔离
    },
  });

  if (VITE_DEV_SERVER_URL) {
    // 开发模式：加载 Vite 启动的本地服务器
    win.loadURL(VITE_DEV_SERVER_URL);
    // 自动打开开发者工具
    win.webContents.openDevTools();
  } else {
    // 生产模式：加载打包后的 index.html
    win.loadFile(indexHtml);
  }

  // 页面加载完成后，向渲染进程发送一条消息
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  // 让所有 https 链接在系统浏览器中打开，而不是新建 Electron 窗口
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" }; // 阻止 Electron 打开新窗口
  });
}

// 当 Electron 初始化完成时，创建主窗口
app.whenReady().then(createWindow);

// 所有窗口关闭时退出应用（macOS 除外）
app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});

// 检测到有第二个实例时，让第一个窗口获得焦点
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

// macOS 下，点击 Dock 图标时如果没有窗口则新建一个
app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// IPC 例子：渲染进程请求新建一个窗口
ipcMain.handle("open-win", (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true, // 允许使用 Node.js API
      contextIsolation: false, // 关闭上下文隔离
    },
  });

  if (VITE_DEV_SERVER_URL) {
    // 开发模式
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`);
  } else {
    // 生产模式
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});

// 打开系统设置的屏幕录制权限页（macOS）
ipcMain.handle("electronMain:openScreenSecurity", () => {
  return openSystemPreferences("security", "Privacy_ScreenCapture");
});

// 获取当前屏幕录制权限是否已授权（macOS）
ipcMain.handle("electronMain:getScreenAccess", () => {
  // 非 macOS 默认返回 true，macOS 上检查权限是否已授权
  return (
    !IS_OSX || systemPreferences.getMediaAccessStatus("screen") === "granted"
  );
});

// 获取可捕获的屏幕/窗口资源列表
ipcMain.handle("electronMain:screen:getSources", async () => {
  try {
    // 获取所有桌面窗口和屏幕资源，包含缩略图
    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: { width: 400, height: 300 }, // 设置缩略图尺寸（可选）
    });
    // 返回加工后的资源列表，每个 source 包含 id、name、缩略图 base64
    return sources.map((source) => ({
      id: source.id, // 唯一 ID，后续用来选取屏幕
      name: source.name, // 屏幕或窗口名称
      type: source.id.startsWith("screen:") ? "screen" : "window",
      thumbnailURL: source.thumbnail.toDataURL(), // 缩略图转为 base64 字符串
    }));
    // const mediaSourceId = remote.getCurrentWindow().getMediaSourceId()
  } catch (err) {
    console.error("Failed to get sources:", err); // 捕获异常防止崩溃
    // return [] // 返回空数组表示失败
    return { error: err };
  }
});

ipcMain.handle("read-cardlist", async (_e, projectPath: string) => {});
