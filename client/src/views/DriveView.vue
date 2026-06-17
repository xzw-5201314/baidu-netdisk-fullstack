<!-- views/DriveView.vue — 主文件浏览页 -->
<template>
  <div class="drive-view">
    <!-- 工具栏 -->
    <Toolbar
      :selected-count="fileStore.selectedIds.length"
      :view-mode="fileStore.viewMode"
      @upload="fileStore.handleUploadClick"
      @create-folder="fileStore.handleCreateFolder"
      @batch-delete="fileStore.handleBatchDelete"
      @sort-change="fileStore.handleSortChange"
      @view-change="fileStore.handleViewChange"
    />

    <!-- 面包屑导航 -->
    <div class="breadcrumb">
      <div
        v-for="(item, index) in fileStore.currentPath"
        :key="index"
        :class="['breadcrumb-item', { active: index === fileStore.currentPath.length - 1 }]"
        @click="index < fileStore.currentPath.length - 1 && fileStore.goToPath(index)"
      >
        {{ item.name }}
        <span v-if="index < fileStore.currentPath.length - 1" class="breadcrumb-arrow">›</span>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="content-body">
      <div v-if="fileStore.refreshing" class="refresh-loading">
        <div class="refresh-spinner"></div>
        <span>加载中...</span>
      </div>
      <template v-else>
        <EmptyState
          v-if="fileStore.container.fileList.length === 0"
          mode="default"
          @upload="fileStore.handleUploadClick"
          @create-folder="fileStore.handleCreateFolder"
        />
        <FileList
          v-else
          :files="fileStore.displayFiles"
          :selected-ids="fileStore.selectedIds"
          :view-mode="fileStore.viewMode"
          :renaming-id="fileStore.renamingId"
          :is-trash-mode="false"
          @preview="handlePreview"
          @download="fileStore.handleDownload"
          @share="shareStore.handleShare"
          @move="handleMove"
          @delete="fileStore.handleDelete"
          @rename="fileStore.handleStartRename"
          @select-change="fileStore.handleSelectChange"
          @enter-folder="fileStore.enterFolder"
          @confirm-create="fileStore.confirmCreateFolder"
          @cancel-create="fileStore.cancelCreate"
          @confirm-rename="fileStore.handleConfirmRename"
          @cancel-rename="fileStore.handleCancelRename"
        />
      </template>
    </div>

    <!-- 移动对话框 -->
    <MoveDialog
      :visible="showMoveDialog"
      v-model="moveTargetId"
      :move-type="moveType"
      :move-id="moveSelectedId"
      @close="showMoveDialog = false"
      @confirm="handleMoveConfirm"
    />

    <!-- 文件预览弹窗 -->
    <PreviewModal
      :visible="previewVisible"
      :url="previewUrl"
      :type="previewType"
      @close="previewVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useFileStore } from '../stores/useFileStore';
import { useShareStore } from '../stores/useShareStore';
import { API_BASE } from '../config/api';
import type { FileItem } from '../types/file';
import type { PreviewType } from '../components/PreviewModal.vue';
import Toolbar from '../components/Toolbar.vue';
import FileList from '../components/FileList.vue';
import EmptyState from '../components/EmptyState.vue';
import MoveDialog from '../components/MoveDialog.vue';
import PreviewModal from '../components/PreviewModal.vue';

const fileStore = useFileStore();
const shareStore = useShareStore();

// 移动对话框状态
const showMoveDialog = ref(false);
const moveTargetId = ref<string | null>(null);
const moveType = ref('file');
const moveSelectedId = ref<string | null>(null);

const handleMove = (file: FileItem) => {
  moveType.value = file.type;
  moveSelectedId.value = file.id;
  moveTargetId.value = null;
  showMoveDialog.value = true;
};

const handleMoveConfirm = async () => {
  showMoveDialog.value = false;
  await fileStore.refreshFileList();
};

// 预览
const previewVisible = ref(false);
const previewUrl = ref('');
const previewType = ref<PreviewType>('video');

const extTypeMap: Record<string, PreviewType> = {
  mp4: 'video', mov: 'video', avi: 'video', webm: 'video',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image',
  pdf: 'pdf',
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio',
};

const handlePreview = (file: FileItem) => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const type = extTypeMap[ext];

  if (!type) {
    ElMessage.warning(`「${file.name}」不支持在线预览`);
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    ElMessage.error('登录已失效，请重新登录');
    return;
  }

  previewUrl.value = `${API_BASE}/api/file/preview?fileId=${file.id}&token=${encodeURIComponent(token)}`;
  previewType.value = type;
  previewVisible.value = true;
};

onMounted(() => {
  fileStore.getFileList();
});
</script>

<style scoped>
.drive-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.content-body {
  flex: 1;
  overflow-y: auto;
  background: #F5F7FA;
  position: relative;
}

.refresh-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: #999;
  font-size: 14px;
}

.refresh-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #E5E6EB;
  border-top-color: #4A90D9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.breadcrumb {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #E5E6EB;
  font-size: 14px;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  color: #646A73;
  cursor: pointer;
  transition: color 0.2s;
}

.breadcrumb-item:hover {
  color: #4A90D9;
}

.breadcrumb-item.active {
  color: #1F2329;
  font-weight: 500;
  cursor: default;
}

.breadcrumb-arrow {
  margin: 0 8px;
  color: #C0C4CC;
}
</style>
