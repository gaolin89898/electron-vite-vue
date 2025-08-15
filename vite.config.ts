import fs from "node:fs"; // Node.js 文件系统模块
import path from "path";
import { defineConfig } from "vite"; // Vite 配置辅助函数
import vue from "@vitejs/plugin-vue"; // Vue 支持插件
import electron from "vite-plugin-electron/simple"; // Electron 集成插件（简易版）
import pkg from "./package.json"; // 项目 package.json 内容
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ArcoResolver } from "unplugin-vue-components/resolvers";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  // 每次启动或构建时先删除之前的 Electron 打包输出目录
  fs.rmSync("dist-electron", { recursive: true, force: true });

  // 判断当前是开发模式还是构建模式
  const isServe = command === "serve"; // 开发模式
  const isBuild = command === "build"; // 构建模式
  // 是否生成 sourcemap，调试时用
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG;

  return {
    plugins: [
      vue(), // Vue 插件，支持 Vue 单文件组件等
      electron({
        // 配置 Electron 主进程构建
        main: {
          // 主进程入口文件
          entry: "electron/main/index.ts",
          // 主进程启动时回调
          onstart({ startup }) {
            if (process.env.VSCODE_DEBUG) {
              // 如果是 VSCode 调试模式，打印日志而不自动启动 Electron
              console.log(
                /* For `.vscode/.debug.script.mjs` */ "[startup] Electron App"
              );
            } else {
              // 否则正常启动 Electron
              startup();
            }
          },
          vite: {
            build: {
              sourcemap, // 是否生成 sourcemap
              minify: isBuild, // 构建时压缩代码
              outDir: "dist-electron/main", // 主进程代码输出目录
              rollupOptions: {
                // 排除依赖（通常是 Node.js 原生模块或者本地二进制模块），避免被打包
                external: Object.keys(
                  "dependencies" in pkg ? pkg.dependencies : {}
                ),
              },
            },
          },
        },
        // 配置 preload 脚本构建
        preload: {
          // 预加载脚本入口文件
          input: "electron/preload/index.ts",
          vite: {
            build: {
              // sourcemap 类型，inline 内联，方便调试
              sourcemap: sourcemap ? "inline" : undefined,
              minify: isBuild, // 构建时压缩
              outDir: "dist-electron/preload", // 预加载脚本输出目录
              rollupOptions: {
                // 同样排除依赖
                external: Object.keys(
                  "dependencies" in pkg ? pkg.dependencies : {}
                ),
              },
            },
          },
        },
        // 这是给渲染进程补充 Electron 和 Node.js API 的插件配置
        // 如果想在渲染进程用 Node.js，需要主进程启用 nodeIntegration
        renderer: {},
      }),
      AutoImport({
        resolvers: [ArcoResolver()],
      }),
      Components({
        resolvers: [
          ArcoResolver({
            sideEffect: true,
          }),
        ],
      }),
    ],
    resolve: {
      symlinks: false,
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@import "./src/assets/style/main.scss";',
        },
      },
    },
    // 开发服务器配置，如果是 vscode 调试模式，则从 package.json 里读取配置
    server:
      process.env.VSCODE_DEBUG &&
      (() => {
        // 从 package.json 的 debug.env.VITE_DEV_SERVER_URL 解析主机名和端口
        const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL);
        return {
          host: url.hostname,
          port: +url.port,
        };
      })(),
    clearScreen: false, // 不清理终端输出，方便查看日志
  };
});
