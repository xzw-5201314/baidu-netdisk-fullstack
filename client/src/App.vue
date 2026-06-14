<template>
  <div class="app">
    <!-- 分享访问页（独立于登录状态） -->
    <router-view v-if="isShareAccessPage" />

    <!-- 登录页面 -->
    <Login v-else-if="!userStore.isLoggedIn" @login-success="handleLoginSuccess" />

    <!-- 主页面 -->
    <template v-else>
      <Header
        :username="userStore.username"
        @logout="handleLogout"
        @refresh="handleRefresh"
        @settings="showSettings = true"
        @search="handleSearch"
        @exit-search="exitSearch"
      />

      <div class="main-content">
        <Sidebar
          :current-nav="currentNav"
          :current-category="currentCategory"
          :used-space="fileStore.usedSpace"
          :total-space="fileStore.totalSpace"
          :used-percent="fileStore.usedPercent"
          :active-transfer-count="transferStore.activeTransferCount"
          @nav-change="handleNavChange"
          @category-change="handleCategoryChange"
        />

        <main class="content">
          <router-view />
        </main>
      </div>
    </template>

    <!-- 文件上传隐藏input -->
    <input
      type="file"
      @change="fileStore.handleFileChange"
      id="file-input"
      class="hidden-file-input"
    />

    <!-- 分享对话框 -->
    <ShareDialog
      :visible="shareStore.showShareDialog"
      :target-id="shareStore.shareTargetId"
      :share-type="shareStore.shareType"
      :share-name="shareStore.shareName"
      @close="shareStore.showShareDialog = false"
    />

    <!-- 设置弹窗 -->
    <div v-if="showSettings" class="settings-overlay" @click.self="showSettings = false">
      <div class="settings-dialog">
        <div class="settings-header">
          <h3>⚙️ 系统设置</h3>
          <button class="settings-close" @click="showSettings = false">✕</button>
        </div>
        <div class="settings-body">
          <div class="settings-item">
            <span class="settings-label">当前用户</span>
            <span class="settings-value">{{ userStore.username }}</span>
          </div>
          <div class="settings-item">
            <span class="settings-label">已用空间</span>
            <span class="settings-value">{{ fileStore.usedSpace }} / {{ fileStore.totalSpace }}</span>
          </div>
          <div class="settings-item">
            <span class="settings-label">API 地址</span>
            <span class="settings-value">{{ apiBase }}</span>
          </div>
          <div class="settings-item">
            <span class="settings-label">版本</span>
            <span class="settings-value">Easy云盘 v1.0</span>
          </div>
        </div>
        <div class="settings-footer">
          <button class="settings-btn" @click="showSettings = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- hash 计算提示 -->
    <div v-if="fileStore.isCalculatingHash" class="hash-toast">
      <div class="hash-toast-spinner"></div>
      <span>校验文件 {{ fileStore.hashProgress }}%</span>
      <button class="hash-toast-cancel" @click="fileStore.cancelUpload">✕</button>
    </div>

    <!-- 拖拽上传遮罩 -->
    <div v-if="isDragging" class="drag-overlay">
      <div class="drag-overlay-content">
        <div class="drag-icon">📂</div>
        <div class="drag-text">释放鼠标立即上传</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import axios from 'axios';
import { API_BASE } from './config/api';
import { isFileOversize } from './utils/file';
import { useUserStore } from './stores/useUserStore';
import { useFileStore } from './stores/useFileStore';
import { useTransferStore } from './stores/useTransferStore';
import { useShareStore } from './stores/useShareStore';
import Login from './components/Login.vue';
import Header from './components/Header.vue';
import Sidebar from './components/Sidebar.vue';
import ShareDialog from './components/ShareDialog.vue';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const fileStore = useFileStore();
const transferStore = useTransferStore();
const shareStore = useShareStore();

const apiBase = API_BASE;
const showSettings = ref(false);
const isDragging = ref(false);
const currentCategory = ref('all');

// 当前导航（基于路由）
const currentNav = computed(() => {
  if (route.name === 'trash') return 'recycle';
  if (route.name === 'transfers') return 'transfer';
  if (route.name === 'shares') return 'share';
  return 'all';
});

// 是否为分享访问页
const isShareAccessPage = computed(() => route.name === 'share-access');

// 请求拦截器：自动携带Token
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 登录成功
const handleLoginSuccess = () => {
  userStore.setLoggedIn();
  router.push('/');
};

// 退出登录
const handleLogout = () => {
  userStore.logout();
  router.push('/login');
};

// 刷新
const handleRefresh = () => {
  fileStore.handleRefresh();
};

// 搜索
const handleSearch = async (keyword: string) => {
  if (!keyword) return;
  // 搜索时跳到首页
  if (route.name !== 'drive') {
    router.push('/');
  }
  // 搜索逻辑在 fileStore 中处理（或直接在此调用 API）
  const { data } = await axios.get(`${API_BASE}/search?q=${encodeURIComponent(keyword)}`);
  if (data.code === 200) {
    fileStore.container.fileList = data.data;
    fileStore.sortFileList();
    fileStore.calculateStorage();
  } else {
    fileStore.container.fileList = [];
  }
};

// 退出搜索
const exitSearch = () => {
  fileStore.resetToRoot();
  fileStore.getFileList();
};

// 导航切换
const handleNavChange = (nav: string) => {
  currentCategory.value = 'all';
  switch (nav) {
    case 'all':
      fileStore.resetToRoot();
      fileStore.getFileList();
      router.push('/');
      break;
    case 'recycle':
      router.push('/trash');
      break;
    case 'transfer':
      router.push('/transfers');
      break;
    case 'share':
      router.push('/shares');
      break;
  }
};

// 分类切换
const handleCategoryChange = async (category: string) => {
  if (route.name !== 'drive') {
    router.push('/');
  }
  currentCategory.value = category;
  fileStore.resetToRoot();
  if (category === 'all') {
    await fileStore.getFileList();
  } else {
    fileStore.currentPath = [{ id: null, name: `分类结果：${fileStore.categoryNameMap[category] || category}` }];
    await fileStore.getFileList(null, category);
  }
};

// ==================== 拖拽上传 ====================
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

const onDocDragEnter = (e: DragEvent) => {
  if (!userStore.isLoggedIn) return;
  if (e.dataTransfer?.types?.includes('Files')) {
    isDragging.value = true;
  }
};

const onDocDragLeave = (e: DragEvent) => {
  if (!userStore.isLoggedIn) return;
  if (e.relatedTarget === null) {
    isDragging.value = false;
  }
};

const onDocDragOver = (e: DragEvent) => {
  e.preventDefault();
};

const onDocDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
  if (!userStore.isLoggedIn) return;

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const oversized: string[] = [];
  const validFiles: File[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (isFileOversize(f, MAX_FILE_SIZE)) {
      oversized.push(f.name);
    } else {
      validFiles.push(f);
    }
  }

  if (oversized.length > 0) {
    alert(`以下文件超过 5GB 限制，已跳过：\n${oversized.join('\n')}`);
  }

  if (validFiles.length > 0) {
    fileStore.uploadFileList(validFiles);
  }
};

onMounted(() => {
  document.addEventListener('dragenter', onDocDragEnter);
  document.addEventListener('dragleave', onDocDragLeave);
  document.addEventListener('dragover', onDocDragOver);
  document.addEventListener('drop', onDocDrop);
});

onUnmounted(() => {
  document.removeEventListener('dragenter', onDocDragEnter);
  document.removeEventListener('dragleave', onDocDragLeave);
  document.removeEventListener('dragover', onDocDragOver);
  document.removeEventListener('drop', onDocDrop);
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app {
  height: 100%;
  background: #F5F7FA;
}

.main-content {
  display: flex;
  height: calc(100vh - 60px);
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hidden-file-input {
  display: none;
}

/* hash toast */
.hash-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #333;
  color: #fff;
  padding: 12px 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  pointer-events: auto;
}

.hash-toast-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.hash-toast-cancel {
  background: none;
  border: none;
  color: rgba(255,255,255,0.7);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
}

.hash-toast-cancel:hover {
  color: #fff;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 设置弹窗 */
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.settings-dialog {
  background: white;
  border-radius: 12px;
  width: 420px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e8e8e8;
}

.settings-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.settings-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #999;
}

.settings-body {
  padding: 20px;
}

.settings-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.settings-item:last-child {
  border-bottom: none;
}

.settings-label {
  font-size: 14px;
  color: #666;
}

.settings-value {
  font-size: 14px;
  color: #333;
}

.settings-footer {
  padding: 12px 20px;
  border-top: 1px solid #e8e8e8;
  text-align: right;
}

.settings-btn {
  padding: 6px 20px;
  background: #4A90D9;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.settings-btn:hover {
  background: #357ABD;
}

/* 拖拽遮罩 */
.drag-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(74, 144, 217, 0.15);
  border: 3px dashed #4A90D9;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.drag-overlay-content {
  text-align: center;
}

.drag-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.drag-text {
  font-size: 20px;
  color: #4A90D9;
  font-weight: 500;
}
</style>
