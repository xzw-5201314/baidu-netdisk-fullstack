<!-- components/PreviewModal.vue — 文件预览弹窗 -->
<template>
  <Teleport to="body">
    <div v-if="visible" class="preview-overlay" @click.self="close">
      <div class="preview-container">
        <button class="preview-close" @click="close">✕ 关闭</button>
        <div class="preview-content">
          <!-- 视频 -->
          <video
            v-if="type === 'video'"
            controls
            autoplay
            class="preview-media"
            :src="url"
          />
          <!-- 图片 -->
          <img
            v-else-if="type === 'image'"
            class="preview-media"
            :src="url"
          />
          <!-- PDF -->
          <iframe
            v-else-if="type === 'pdf'"
            class="preview-pdf"
            :src="url"
          />
          <!-- 音频 -->
          <audio
            v-else-if="type === 'audio'"
            controls
            autoplay
            :src="url"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';

export type PreviewType = 'video' | 'image' | 'pdf' | 'audio';

const props = defineProps<{
  visible: boolean;
  url: string;
  type: PreviewType;
}>();

const emit = defineEmits(['close']);

const close = () => {
  emit('close');
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible) {
    close();
  }
};

// 监听 ESC 键
onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
});

// 打开时禁止背景滚动
watch(() => props.visible, (val) => {
  document.body.style.overflow = val ? 'hidden' : '';
});
</script>

<style scoped>
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.preview-container {
  position: relative;
  max-width: 95vw;
  max-height: 95vh;
}

.preview-close {
  position: absolute;
  top: -36px;
  right: 0;
  background: none;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  z-index: 10001;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.preview-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.preview-content {
  text-align: center;
}

.preview-media {
  max-width: 100%;
  max-height: 85vh;
  object-fit: contain;
}

.preview-pdf {
  width: 100%;
  height: 85vh;
  border: none;
}
</style>
