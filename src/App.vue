<script setup lang="ts">
import HelloWorld from "./components/HelloWorld.vue";
import { onMounted, ref, computed } from "vue";

const screenSources = ref([]);
const windowSources = ref([]);
const currentSources = computed(() => {
  return tabactive.value === 'window' ? windowSources.value : screenSources.value;
});
const selectedSource = ref<any>(null);
const isSharingAudio = ref(false);
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
const selectSource = (source: any) => {
  selectedSource.value = source;
};

const startSharing = async () => {
  if (!selectedSource.value) {
    return;
  }
  
  sharescreenVisible.value = false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: isSharingAudio.value && tabactive.value === 'screen', // 只有屏幕共享时才支持音频
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: selectedSource.value.id,
          maxWidth: 1920,
          maxHeight: 1080,
          maxFrameRate: 30,
        } as any,
      },
    });
    videoRef.value.srcObject = stream;
    await videoRef.value.play();
    console.log('开始共享:', selectedSource.value.name, stream);
  } catch (error) {
    console.error('共享失败:', error);
  }
};

const cancelSharing = () => {
  sharescreenVisible.value = false;
  selectedSource.value = null;
};

onMounted(() => {
  getDisplayMedia();
});
</script>

<template>
  <a-button @click="handleClick">Open Modal</a-button>
  
  <!-- 预览区域 -->
  <div v-if="selectedSource" class="preview-area">
    <h3>预览: {{ selectedSource.name }}</h3>
    <video ref="videoRef" autoplay muted class="preview-video"></video>
  </div>
  <a-modal
    v-model:visible="sharescreenVisible"
    simple
    hide-title
    title="选择要共享的屏幕或窗口"
          width="680px"
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
              height: 400px;
              overflow: auto;
            "
            type="track"
          >
            <div class="screen-grid" :class="{ 'few-items': currentSources.length <= 2 }">
              <div
                v-for="(item, index) in currentSources"
                :key="item.id"
                class="screen-item"
                :class="{ 'selected': selectedSource?.id === item.id }"
                @click="selectSource(item)"
              >
                <img :src="item.thumbnailURL" class="screen-thumbnail" />
                <div class="screen-label">
                  <span>{{ item.name }}</span>
                </div>
              </div>
            </div>
          </a-scrollbar>
        </div>
        <div class="screen-hint">
          <div class="hint-text">
            <span v-if="tabactive == 'window'">若要分享音频，请改为共享屏幕</span>
            <span v-else>同时分享系统音频</span>
          </div>
          <a-switch 
            v-if="tabactive == 'screen'" 
            v-model:checked="isSharingAudio"
            size="small"
          />
        </div>
      </a-tab-pane>
    </a-tabs>

    <div class="modal-footer">
      <a-button 
        style="margin-right: 10px" 
        @click="cancelSharing"
        :disabled="!selectedSource"
      >
        取消
      </a-button>
      <a-button 
        type="primary" 
        @click="startSharing"
        :disabled="!selectedSource"
      >
        开始共享
      </a-button>
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
            margin: 0;
          }
        }
      }
    }
    :deep(.arco-tabs-nav-type-line .arco-tabs-tab) {
      margin: 0;
    }
    :deep(.arco-tabs-nav-type-line .arco-tabs-tab) {
      margin: 0;
    }
    :deep(.arco-tabs-content) {
      padding-top: 0;
      background: #e1e9f1;
      border-radius: 0 0 10px 10px;
    }
  }
  .screen-list {
    width: calc(100% - 30px);
    height: 400px;
    margin: 0 auto;

    :deep(.arco-scrollbar) {
      width: 100%;
      margin: 10px 0;
      
      // 隐藏滚动条
      .arco-scrollbar-track {
        display: none;
      }
      
      .arco-scrollbar-thumb {
        display: none;
      }
    }

    .screen-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      padding: 10px;
      width: 100%;
      max-width: 100%;
      
      &.few-items {
        max-width: 580px;
        margin: 0 auto;
        justify-content: center;
        gap: 28px;
        
        .screen-item {
          width: 250px !important;
          max-width: 250px !important; // 覆盖普通状态的最大宽度限制
          height: 200px !important;
          
          .screen-thumbnail {
            height: 160px !important;
            object-fit: contain !important;
            background: transparent !important;
          }
          
          .screen-label {
            height: 40px !important;
            padding: 4px 0 12px 0 !important;
            
            span {
              font-size: 14px !important;
              line-height: 1.2 !important;
            }
          }
        }
      }
    }

    .screen-item {
      width: 100%;
      min-width: 0; // 允许项目收缩
      max-width: 180px; // 限制最大宽度，确保3列布局
      height: 150px;
      border: 2px solid transparent;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      text-align: center;
      transition: border-color 0.3s;
      .screen-thumbnail {
        width: 100%;
        height: 110px;
        object-fit: contain;
        background: transparent;
      }
      .screen-label {
        width: 100%;
        height: 40px;
        // background: #ffffff;
        display: flex;
        justify-content: center;
        align-items: center;
        span {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 13px;
          padding: 0 10px;
        }
      }
      &:hover {
        border-color: #409eff;
      }

      &.selected {
        border-color: #165dff !important;
        box-shadow: 0 0 0 2px rgba(22, 93, 255, 0.2);
      }
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
    
    .hint-text {
      color: #666;
      font-size: 13px;
    }
  }

  .modal-footer {
    text-align: right;
    padding-top: 16px;
    
    .arco-btn {
      min-width: 80px;
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
}

.preview-area {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #f7f8fa;
  
  h3 {
    margin: 0 0 10px 0;
    color: #1d2129;
    font-size: 16px;
  }
  
  .preview-video {
    width: 100%;
    max-width: 400px;
    height: auto;
    border-radius: 4px;
    background: #000;
  }
}
</style>
