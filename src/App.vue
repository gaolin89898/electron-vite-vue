<script setup lang="ts">
import HelloWorld from "./components/HelloWorld.vue";
import { onMounted, ref } from "vue";

const screenSources = ref([]);
const windowSources = ref([]);
const getDisplayMedia = () => {
  const main = window.ipcRenderer;
  return new Promise(async (resolve, reject) => {
    // 先检查是否有屏幕录制权限
    let has_access = await main?.getScreenAccess();
    console.log("屏幕权限", has_access);

    if (!has_access) {
      return reject("none"); // 没有权限，直接返回失败
    }
    // 从主进程获取可用的屏幕/窗口列表
    const sources = await main?.getScreenSources();
    screenSources.value = sources.filter((item) => item.type === "screen");
    windowSources.value = sources.filter((item) => item.type === "window");
    console.log("可共享的屏幕", sources);
  });
};

const sharescreenVisible = ref(false);
const tabactive = ref("window");
const handleClick = () => {
  sharescreenVisible.value = true;
};

const videoRef = ref();
const tablist = ref([
  {
    key: "window",
    title: "窗口",
  },
  {
    key: "screen",
    title: "整个屏幕",
  },
]);
const tabChange = (key: string | number) => {
  tabactive.value = key as string;
};
const sharedClick = async (id) => {
  sharescreenVisible.value = false;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false, // 你可以根据需求选择是否捕获音频
    video: {
      mandatory: {
        chromeMediaSource: "desktop", // 必须是 desktop
        chromeMediaSourceId: id, // 传入你选中的 id
        maxWidth: 1920, // 最大宽高，按需设置
        maxHeight: 1080,
        maxFrameRate: 30,
      },
    },
  });
  videoRef.value.srcObject = stream;
  await videoRef.value.play();
  console.log(stream);
};

onMounted(() => {
  getDisplayMedia();
});
</script>

<template>
  <a-button @click="handleClick">Open Modal</a-button>
  <a-modal
    v-model:visible="sharescreenVisible"
    simple
    hide-title
    title="选择要共享的屏幕或窗口"
    width="610px"
    :footer="false"
    body-class="screenModal"
    :modal-style="{
      padding: '15px',
      'border-radius': '12px',
    }"
  >
    <div class="screen-header">
      <span>请选择要分享的内容</span>
    </div>
    <a-tabs :active-key="tabactive" @change="tabChange" class="screen-tabs">
      <a-tab-pane v-for="item in tablist" :key="item.key" :title="item.title">
        <div class="screen-list">
          <a-scrollbar
            style="
              width: 100%;
              height: 340px;
              overflow: auto;
              display: flex;
              gap: 16px;
              flex-wrap: wrap;
              justify-content: center;
            "
          >
            <div
              v-for="(item, index) in tabactive == 'window'
                ? windowSources
                : screenSources"
              :key="item.id"
              class="screen-item"
            >
              <img :src="item.thumbnailURL" class="screen-thumbnail" />
              <div class="screen-label">{{ item.name }}</div>
            </div>
          </a-scrollbar>
        </div>
        <div class="screen-hint">
          <span>若要分享音频，请改为共享屏幕</span>
        </div>
      </a-tab-pane>
    </a-tabs>

    <div class="modal-footer">
      <a-button>取消</a-button>
      <a-button type="primary">开始共享</a-button>
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
.screenModal {
  .screen-tabs {
    :deep(.arco-tabs-nav) {
      width: 100%;
      .arco-tabs-nav-tab {
        width: 100%;
        .arco-tabs-nav-tab-list {
          width: 100%;
          display: flex;
          justify-content: space-between;
          .arco-tabs-tab {
            width: 50%;
            justify-content: center;
          }
        }
      }
    }
    :deep(.arco-tabs-content) {
      padding-top: 0;
      background: #e1e9f1;
      border-radius: 0 0 10px 10px;
    }
  }
  .screen-list {
    width: calc(100% - 30px);
    height: 340px;
    margin: 0 auto;

    :deep(.arco-scrollbar) {
      width: 100%;
    }

    .screen-item {
      width: 180px;
      height: 170px;
      border: 2px solid transparent;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      text-align: center;
      transition: border-color 0.3s;
      .screen-label {
        font-size: 14px;
        overflow: hidden;
      }
    }

    .screen-item:hover {
      border-color: #409eff;
    }

    .screen-item .selected {
      border-color: #165dff;
    }
  }
  .screen-hint {
    width: calc(100% - 30px);
    height: 40px;
    margin: 0 auto;
    border-top: 1px solid rgb(148, 152, 160);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .screen-thumbnail {
    width: 100%;
    // height: 150px;
    object-fit: cover;
  }

  .modal-footer {
    text-align: right;
    padding-top: 16px;
  }
}
</style>
