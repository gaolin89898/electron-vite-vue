import { ipcRenderer, contextBridge } from "electron";

// --------- 通过 contextBridge 安全地暴露 IPC API 给渲染进程 ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  // 监听某个频道事件
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args)
    );
  },
  // 取消监听
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  // 发送消息到主进程（异步）
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  // 发送消息到主进程并等待回复（类似 RPC）
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },

  openScreenSecurity: () =>
    ipcRenderer.invoke("electronMain:openScreenSecurity"),
  getScreenAccess: () => ipcRenderer.invoke("electronMain:getScreenAccess"),
  getScreenSources: () => ipcRenderer.invoke("electronMain:screen:getSources"),

  // 这里还可以暴露其他需要的 API
});

// --------- DOM 加载状态判断函数 ---------
function domReady(
  condition: DocumentReadyState[] = ["complete", "interactive"] // 满足任意一个状态就算加载完成
) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      // 如果已经满足状态，立即 resolve
      resolve(true);
    } else {
      // 否则监听 readystatechange 事件，等待状态变更
      document.addEventListener("readystatechange", () => {
        if (condition.includes(document.readyState)) {
          resolve(true);
        }
      });
    }
  });
}

// --------- DOM 安全操作，避免重复添加或删除节点 ---------
const safeDOM = {
  // 如果父元素没有该子元素，才添加
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find((e) => e === child)) {
      return parent.appendChild(child);
    }
  },
  // 如果父元素包含该子元素，才移除
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find((e) => e === child)) {
      return parent.removeChild(child);
    }
  },
};

/**
 * 加载动画 CSS 和 DOM 元素
 * 参考资源：
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  // 定义加载动画的 CSS 类名
  const className = `loaders-css__square-spin`;
  // 动画的关键帧和样式
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
  `;
  // 创建 style 标签
  const oStyle = document.createElement("style");
  // 创建加载动画外层 div
  const oDiv = document.createElement("div");

  oStyle.id = "app-loading-style";
  oStyle.innerHTML = styleContent;
  oDiv.className = "app-loading-wrap";
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`;

  return {
    // 添加加载动画样式和元素到页面
    appendLoading() {
      safeDOM.append(document.head, oStyle);
      safeDOM.append(document.body, oDiv);
    },
    // 移除加载动画样式和元素
    removeLoading() {
      safeDOM.remove(document.head, oStyle);
      safeDOM.remove(document.body, oDiv);
    },
  };
}

// ----------------------------------------------------------------------

// 创建加载动画实例
const { appendLoading, removeLoading } = useLoading();
// DOM 准备好后添加加载动画
domReady().then(appendLoading);

// 监听来自窗口的消息，如果收到移除加载动画的请求，则执行
window.onmessage = (ev) => {
  ev.data.payload === "removeLoading" && removeLoading();
};

// 5秒后强制移除加载动画，防止动画一直显示
setTimeout(removeLoading, 4999);
