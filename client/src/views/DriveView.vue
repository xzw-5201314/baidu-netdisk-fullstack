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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useFileStore } from '../stores/useFileStore';
import { useShareStore } from '../stores/useShareStore';
import Toolbar from '../components/Toolbar.vue';
import FileList from '../components/FileList.vue';
import EmptyState from '../components/EmptyState.vue';
import MoveDialog from '../components/MoveDialog.vue';

const fileStore = useFileStore();
const shareStore = useShareStore();

// 移动对话框状态
const showMoveDialog = ref(false);
const moveTargetId = ref<string | null>(null);
const moveType = ref('file');
const moveSelectedId = ref<string | null>(null);

const handleMove = (file: any) => {
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
const API_BASE = 'http://localhost:3000';

const handlePreview = (file: any) => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const token = localStorage.getItem('token');

  if (!token) {
    alert('登录已失效，请重新登录');
    return;
  }

  const url = `${API_BASE}/api/file/preview?fileId=${file.id}&token=${encodeURIComponent(token)}`;

  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) {
    openPreviewModal(`<video controls autoplay style="max-width:100%;max-height:85vh" src="${url}"></video>`);
  } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) {
    openPreviewModal(`<img src="${url}" style="max-width:100%;max-height:85vh;object-fit:contain" />`);
  } else if (ext === 'pdf') {
    openPreviewModal(`<iframe src="${url}" style="width:100%;height:85vh;border:none"></iframe>`);
  } else if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
    openPreviewModal(`<audio controls autoplay src="${url}"></audio>`);
  } else {
    alert(`「${file.name}」\n\n该文件类型不支持在线预览`);
  }
};

const openPreviewModal = (html: string) => {
  document.getElementById('preview-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'preview-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
  overlay.innerHTML = `
    <div style="position:relative;max-width:95vw;max-height:95vh">
      <button id="preview-close-btn" style="position:absolute;top:-36px;right:0;background:none;border:none;color:#fff;font-size:24px;cursor:pointer;z-index:10001">✕ 关闭</button>
      <div style="text-align:center">${html}</div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);

  document.getElementById('preview-close-btn')?.addEventListener('click', () => overlay.remove());

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
    }
  };
  document.addEventListener('keydown', onKeydown);
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
