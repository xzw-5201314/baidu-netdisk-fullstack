<template>
  <div class="app">
    <!-- 登录页面 -->
    <Login v-if="!isLoggedIn" @login-success="handleLoginSuccess" />
    
    <!-- 主页面 -->
    <template v-else>
      <Header :username="username" :searching="isSearchMode" @logout="handleLogout" @refresh="handleRefresh" @settings="showSettings = true" @search="handleSearch" @exit-search="exitSearch" />
      
      <div class="main-content">
        <Sidebar 
          :current-nav="currentNav"
          :current-category="currentCategory"
          :used-space="usedSpace"
          :total-space="totalSpace"
          :used-percent="usedPercent"
          @nav-change="handleNavChange"
          @category-change="handleCategoryChange"
        />
        
        <main class="content">
          <Toolbar 
            :selected-count="selectedIds.length"
            :view-mode="viewMode"
            @upload="handleUploadClick"
            @create-folder="handleCreateFolder"
            @batch-delete="handleBatchDelete"
            @sort-change="handleSortChange"
            @view-change="handleViewChange"
          />
          
          <!-- 面包屑导航 -->
          <div class="breadcrumb">
              <div 
                v-for="(item, index) in currentPath" 
                :key="index"
                :class="['breadcrumb-item', { active: index === currentPath.length - 1 }]"
                @click="index < currentPath.length - 1 && goToPath(index)"
              >
                {{ item.name }}
                <span v-if="index < currentPath.length - 1" class="breadcrumb-arrow">›</span>
              </div>
            </div>
          
          <div class="content-body">
            <div v-if="refreshing" class="refresh-loading">
              <div class="refresh-spinner"></div>
              <span>加载中...</span>
            </div>
            <template v-else>
            <EmptyState
              v-if="container.fileList.length === 0"
              :mode="isSearchMode ? 'search' : 'default'"
              @upload="handleUploadClick"
              @create-folder="handleCreateFolder"
            />
            <FileList
              v-else
              :files="displayFiles"
              :selected-ids="selectedIds"
              :view-mode="viewMode"
              :renaming-id="renamingId"
              @preview="handlePreview"
              @download="handleDownload"
              @move="handleMove"
              @delete="handleDelete"
              @rename="handleStartRename"
              @select-change="handleSelectChange"
              @enter-folder="enterFolder"
              @confirm-create="confirmCreateFolder"
              @cancel-create="cancelCreate"
              @confirm-rename="handleConfirmRename"
              @cancel-rename="handleCancelRename"
            />
            </template>
          </div>
        </main>
      </div>
    </template>
    
    <!-- 文件上传隐藏input -->
    <input 
      type="file" 
      @change="handleFileChange" 
      id="file-input" 
      class="hidden-file-input"
    />
    
    <!-- 移动对话框 -->
    <MoveDialog
      :visible="showMoveDialog"
      v-model="moveTargetId"
      :move-type="moveType"
      :move-id="moveSelectedId"
      @close="showMoveDialog = false"
      @confirm="handleMoveConfirm"
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
            <span class="settings-value">{{ username }}</span>
          </div>
          <div class="settings-item">
            <span class="settings-label">已用空间</span>
            <span class="settings-value">{{ usedSpace }} / {{ totalSpace }}</span>
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

    <!-- 上传进度条 -->
    <div v-if="container.isShowProgress" class="progress-overlay">
      <div class="progress-modal">
        <div class="progress-header">
          <span>{{ isCalculatingHash ? '正在校验文件...' : '上传中...' }}</span>
          <button class="progress-close" @click="cancelUpload">✕</button>
        </div>
        <div v-if="isCalculatingHash" class="hash-checking">
          <div class="progress-bar-container">
            <div class="progress-bar-fill" :style="{ width: hashProgress + '%' }"></div>
          </div>
          <span>正在计算文件指纹... {{ hashProgress }}%</span>
        </div>
        <template v-else>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" :style="{ width: container.uploadProgress + '%' }"></div>
          </div>
          <div class="progress-text">{{ container.uploadProgress }}%</div>
          <button
            v-if="container.uploading"
            @click="togglePause"
            class="progress-pause-btn"
          >
            {{ container.isPaused ? '继续上传' : '暂停上传' }}
          </button>
        </template>
      </div>
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
import { reactive, ref, onMounted, onUnmounted, computed } from 'vue';
import axios from 'axios';
import { API_BASE } from './config/api';
import Login from './components/Login.vue';

const apiBase = API_BASE;
import Header from './components/Header.vue';
import Sidebar from './components/Sidebar.vue';
import Toolbar from './components/Toolbar.vue';
import FileList from './components/FileList.vue';
import EmptyState from './components/EmptyState.vue';
import MoveDialog from './components/MoveDialog.vue';



const isLoggedIn = ref(false);
const username = ref('');
const currentNav = ref('all');
const viewMode = ref('list');
const selectedIds = ref<string[]>([]);
const usedSpace = ref('0 GB');
const totalSpace = ref('15 GB');
const usedPercent = ref(0);
const currentCategory = ref('all');
const showSettings = ref(false);
const refreshing = ref(false);
const renamingId = ref<string | null>(null);

// 拖拽上传状态
const isDragging = ref(false);
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
const fileHash = ref('');
const isCalculatingHash = ref(false);
const hashProgress = ref(0);

// 计算文件 MD5 hash（Web Worker 后台计算，不阻塞主线程）
const calculateFileHash = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./workers/hash.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'progress') {
        hashProgress.value = Math.round((e.data.current / e.data.total) * 100);
      } else if (e.data.type === 'done') {
        worker.terminate();
        resolve(e.data.hash);
      } else if (e.data.type === 'error') {
        worker.terminate();
        reject(new Error(e.data.message));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    worker.postMessage(file);
  });
};
const sortBy = ref('time-desc');

// 搜索状态
const searchKeyword = ref('');
const isSearchMode = computed(() => searchKeyword.value.length > 0);



// 移动对话框状态
const showMoveDialog = ref(false);
const moveTargetId = ref<string | null>(null);
const moveType = ref('file');
const moveSelectedId = ref<string | null>(null);

// 文件夹相关状态
const currentFolderId = ref<string | null>(null);
const currentPath = ref<{ id: string | null; name: string }[]>([
  { id: null, name: '全部文件' }
]);

const container = reactive({
  file: null as File | null,
  uploadProgress: 0,
  uploading: false,
  fileList: [] as any[],
  isPaused: false,
  isShowProgress: false 
});


// 分类名称映射
const categoryNameMap: Record<string, string> = {
  video: '视频',
  music: '音乐',
  image: '图片',
  doc: '文档',
  other: '其他',
};

// 是否处于分类模式
const isCategoryMode = computed(() => currentCategory.value !== 'all');

// 3. 过滤后的文件列表（分类过滤已由后端完成）
const displayFiles = computed(() => container.fileList);

// 4. 处理分类变化
const handleCategoryChange = async (category: string) => {
  currentCategory.value = category;
  selectedIds.value = [];

  if (category === 'all') {
    // 回到全部文件：重置到根目录
    currentFolderId.value = null;
    currentPath.value = [{ id: null, name: '全部文件' }];
    await getFileList();
  } else {
    // 分类模式：重置路径，拉取全量分类数据
    currentFolderId.value = null;
    currentPath.value = [{ id: null, name: `分类结果：${categoryNameMap[category] || category}` }];
    await getFileList(null, category);
  }
};

// 检查登录状态
const checkLogin = async () => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const res = await axios.get(`${API_BASE}/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.code === 200) {
        isLoggedIn.value = true;
        username.value = res.data.data.username;
        getFileList();
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
    }
  }
};

// 登录成功
const handleLoginSuccess = () => {
  username.value = localStorage.getItem('username') || '';
  isLoggedIn.value = true;
  getFileList();
};

// 退出登录
const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  isLoggedIn.value = false;
};

// 处理移动
const handleMove = (file: any) => {
  moveType.value = file.type;
  moveSelectedId.value = file.id;
  moveTargetId.value = null;
  showMoveDialog.value = true;
};

// 确认移动
const handleMoveConfirm = async () => {
  showMoveDialog.value = false;
  await refreshFileList();
};

// 请求拦截器：自动携带Token
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 获取文件列表
const getFileList = async (folderId?: string | null, category?: string) => {
  try {
    // 构建文件查询参数
    const params = new URLSearchParams();
    if (category && category !== 'all') {
      params.set('category', category);
    } else if (folderId) {
      params.set('folderId', folderId);
    }

    // 获取文件列表
    const filesRes = await axios.get(`${API_BASE}/files?${params.toString()}`);

    // 分类模式下不获取文件夹，目录模式下获取文件夹
    let folders: any[] = [];
    if (!category || category === 'all') {
      const foldersRes = await axios.get(folderId
        ? `${API_BASE}/folders?parentId=${folderId}`
        : `${API_BASE}/folders?parentId=null`
      );
      folders = foldersRes.data.code === 200
        ? foldersRes.data.data.map((folder: any) => ({
            id: folder.id || folder._id,
            name: folder.name,
            type: 'folder',
            size: '0 KB',
            time: ''
          }))
        : [];
    }

    // 处理文件数据
    const files = filesRes.data.code === 200
      ? filesRes.data.data.map((file: any) => ({
          ...file,
          type: 'file'
        }))
      : [];

    // 合并并排序（文件夹优先）
    container.fileList = [...folders, ...files];
    sortFileList();
    calculateStorage();
  } catch (error) {
    console.error('获取列表失败:', error);
  }
};

// 进入文件夹
const enterFolder = async (folder: any) => {
  // 从分类或搜索模式进入文件夹时，退出特殊模式
  if (isCategoryMode.value || isSearchMode.value) {
    currentCategory.value = 'all';
    searchKeyword.value = '';
    currentPath.value = [{ id: null, name: '全部文件' }];
  }
  currentFolderId.value = folder.id;
  currentPath.value.push({ id: folder.id, name: folder.name });
  await getFileList(folder.id);
};

// 跳转到指定路径
const goToPath = async (index: number) => {
  // 截断路径数组到指定索引
  currentPath.value = currentPath.value.slice(0, index + 1);
  const targetPath = currentPath.value[index];
  currentFolderId.value = targetPath.id;
  await getFileList(targetPath.id);
};

// 计算存储空间
const calculateStorage = () => {
  const totalBytes = container.fileList.reduce((sum, file) => {
    const sizeStr = file.size;
    const match = sizeStr.match(/([\d.]+)\s*(MB|GB)/);
    if (match) {
      const num = parseFloat(match[1]);
      return sum + (match[2] === 'GB' ? num * 1024 : num);
    }
    return sum;
  }, 0);
  
  usedPercent.value = Math.round((totalBytes / (15 * 1024)) * 100);
  if (totalBytes > 1024) {
    usedSpace.value = (totalBytes / 1024).toFixed(2) + ' GB';
  } else {
    usedSpace.value = totalBytes.toFixed(2) + ' MB';
  }
};

// 刷新文件列表
const handleRefresh = async () => {
  refreshing.value = true;
  selectedIds.value = [];
  await new Promise(r => setTimeout(r, 500));
  await refreshFileList();
  refreshing.value = false;
};

// 搜索
const handleSearch = async (keyword: string) => {
  if (!keyword) return;
  searchKeyword.value = keyword;
  currentCategory.value = 'all';
  currentFolderId.value = null;
  currentPath.value = [{ id: null, name: `搜索结果："${keyword}"` }];
  selectedIds.value = [];
  try {
    const res = await axios.get(`${API_BASE}/search?q=${encodeURIComponent(keyword)}`);
    container.fileList = res.data.code === 200 ? res.data.data : [];
    sortFileList();
    calculateStorage();
  } catch (error) {
    console.error('搜索失败:', error);
    container.fileList = [];
  }
};

// 退出搜索
const exitSearch = () => {
  searchKeyword.value = '';
  currentCategory.value = 'all';
  currentFolderId.value = null;
  currentPath.value = [{ id: null, name: '全部文件' }];
  getFileList();
};

// 统一刷新：根据当前模式拉取数据
const refreshFileList = () => {
  if (isSearchMode.value) {
    return handleSearch(searchKeyword.value);
  }
  if (isCategoryMode.value) {
    return getFileList(null, currentCategory.value);
  }
  return getFileList(currentFolderId.value);
};

// 重命名
const handleStartRename = (id: string) => {
  renamingId.value = id;
};

const handleConfirmRename = async (newName: string) => {
  if (!renamingId.value || !newName.trim()) {
    renamingId.value = null;
    return;
  }
  try {
    const file = container.fileList.find(f => f.id === renamingId.value);
    if (!file) return;
    if (file.type === 'folder') {
      await axios.patch(`${API_BASE}/folders/${renamingId.value}/rename`, { newName: newName.trim() });
    } else {
      await axios.patch(`${API_BASE}/files/${renamingId.value}/rename`, { newName: newName.trim() });
    }
    await refreshFileList();
  } catch (error: any) {
    alert(error.response?.data?.msg || '重命名失败');
  } finally {
    renamingId.value = null;
  }
};

const handleCancelRename = () => {
  renamingId.value = null;
};

// 导航切换
const handleNavChange = async (nav: string) => {
  currentNav.value = nav;
  if (nav === 'all') {
    searchKeyword.value = '';
    currentCategory.value = 'all';
    currentFolderId.value = null;
    currentPath.value = [{ id: null, name: '全部文件' }];
    await getFileList();
  }
};

// 分类切换（已在前面定义）

// 视图切换
const handleViewChange = (view: string) => {
  viewMode.value = view;
};

// 排序切换
const handleSortChange = (sort: string) => {
  sortBy.value = sort;
  sortFileList();
};

// 解析大小字符串为 MB 数值
const parseSize = (sizeStr: string): number => {
  const match = sizeStr.match(/([\d.]+)\s*(MB|GB|KB)/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'GB') return num * 1024;
  if (unit === 'KB') return num / 1024;
  return num;
};

// 排序文件列表（文件夹始终在前）
const sortFileList = () => {
  const folders = container.fileList.filter(f => f.type === 'folder');
  const files = container.fileList.filter(f => f.type !== 'folder');

  files.sort((a, b) => {
    switch (sortBy.value) {
      case 'name-asc':
        return a.name.localeCompare(b.name, 'zh');
      case 'name-desc':
        return b.name.localeCompare(a.name, 'zh');
      case 'size-asc':
        return parseSize(a.size) - parseSize(b.size);
      case 'size-desc':
        return parseSize(b.size) - parseSize(a.size);
      case 'time-asc':
        return new Date(a.time).getTime() - new Date(b.time).getTime();
      case 'time-desc':
      default:
        return new Date(b.time).getTime() - new Date(a.time).getTime();
    }
  });

  container.fileList = [...folders, ...files];
};

// 选择变化
const handleSelectChange = (ids: string[]) => {
  selectedIds.value = ids;
};

// 上传点击
const handleUploadClick = () => {
  const input = document.getElementById('file-input') as HTMLInputElement;
  input?.click();
};

// 拖拽上传
const onDocDragEnter = (e: DragEvent) => {
  if (!isLoggedIn.value) return;
  if (e.dataTransfer?.types?.includes('Files')) {
    isDragging.value = true;
  }
};

const onDocDragLeave = (e: DragEvent) => {
  if (!isLoggedIn.value) return;
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
  if (!isLoggedIn.value) return;

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  // 检查文件大小
  const oversized: string[] = [];
  const validFiles: File[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.size > MAX_FILE_SIZE) {
      oversized.push(f.name);
    } else {
      validFiles.push(f);
    }
  }

  if (oversized.length > 0) {
    alert(`以下文件超过 5GB 限制，已跳过：\n${oversized.join('\n')}`);
  }

  if (validFiles.length > 0) {
    uploadFileList(validFiles);
  }
};

// 多文件队列上传
const uploadFileList = async (fileList: File[]) => {
  for (const file of fileList) {
    container.file = file;
    container.isShowProgress = true;
    container.uploadProgress = 0;
    container.uploading = false;
    await handleUploadWithHash();
  }
};

// 暂停/继续
const togglePause = () => {
  container.isPaused = !container.isPaused;
};

// 取消上传
const cancelUpload = () => {
  container.isShowProgress = false;
  container.uploading = false;
  container.isPaused = false;
  container.uploadProgress = 0;
  fileHash.value = '';
  isCalculatingHash.value = false;
  hashProgress.value = 0;
};

// 创建文件夹（内联模式）
const handleCreateFolder = () => {
  // 1. 防止重复点击新建
  if (container.fileList.some(item => item.isEditing)) return;

  // 2. 在列表最前面插入一个空文件夹模板
  container.fileList.unshift({
    id: 'temp-' + Date.now(), // 临时ID
    name: '',                // 初始名称为空
    type: 'folder',
    isEditing: true,         // 关键标识：进入编辑模式
    size: '-',
    time: '-'
  });
};

// 提交新建文件夹
const confirmCreateFolder = async (name: string) => {
  if (!name || name.trim() === '') {
    // 如果名字为空，直接移除临时行
    container.fileList.shift();
    return;
  }
  
  try {
    await axios.post(`${API_BASE}/folders`, {
      name: name,
      parentId: currentFolderId.value || null
    });
    // 重新获取列表
    await refreshFileList();
  } catch (error) {
    alert('创建失败');
    container.fileList.shift();
  }
};

// 取消新建
const cancelCreate = () => {
  container.fileList.shift();
};

// 批量删除
const handleBatchDelete = () => {
  if (!confirm(`确定删除选中的 ${selectedIds.value.length} 个文件吗？`)) return;
  selectedIds.value.forEach(id => {
    const file = container.fileList.find(f => f.id === id);
    if (file) {
      handleDelete({ name: file.name });
    }
  });
  selectedIds.value = [];
};

// 查询后端已上传的分片
const checkUploadedChunks = async (fileName: string) => {
  const res = await axios.get(`${API_BASE}/check-chunks/${encodeURIComponent(fileName)}`);
  return res.data.data || [];
};

// 定义分片类型
interface ChunkItem {
  chunk: Blob;
  index: number;
}

// 创建文件分片
const createFileChunks = (file: File): ChunkItem[] => {
  const chunkSize = 1024 * 1024;
  const chunks: ChunkItem[] = [];
  let start = 0;
  let index = 0;
  while (start < file.size) {
    const end = start + chunkSize;
    chunks.push({ chunk: file.slice(start, end), index });
    start = end;
    index++;
  }
  return chunks;
};

// 文件选择
const handleFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    container.file = target.files[0];
    container.isShowProgress = true;
    container.uploadProgress = 0;
    await handleUploadWithHash();
  }
};

// 带秒传检查的上传流程
const handleUploadWithHash = async () => {
  if (!container.file) return;

  // 1. 计算文件 hash
  isCalculatingHash.value = true;
  try {
    fileHash.value = await calculateFileHash(container.file);
  } catch {
    fileHash.value = '';
  }
  isCalculatingHash.value = false;
  hashProgress.value = 0;

  // 2. 检查是否可以秒传
  if (fileHash.value) {
    try {
      const res = await axios.post(`${API_BASE}/check-hash`, {
        fileHash: fileHash.value,
        fileName: container.file.name,
        fileSize: container.file.size,
        folderId: currentFolderId.value || null
      });
      if (res.data.data?.exists) {
        container.uploadProgress = 100;
        setTimeout(() => {
          container.isShowProgress = false;
          container.uploadProgress = 0;
          container.uploading = false;
          container.file = null;
          fileHash.value = '';
          refreshFileList();
        }, 500);
        return;
      }
    } catch {
      // 秒传检查失败，继续正常上传
    }
  }

  // 3. 正常上传
  await handleUpload();
};

// 上传逻辑
const handleUpload = async () => {
  if (!container.file || container.uploading) return;
  container.uploading = true;
  container.isPaused = false;

  const chunks = createFileChunks(container.file);
  const uploaded = await checkUploadedChunks(container.file.name);
  const needUpload = chunks.filter((_, i) => !uploaded.includes(i));

  let total = chunks.length;
  let success = uploaded.length;

  const updateProgress = () => {
    container.uploadProgress = Math.round((success / total) * 100);
  };
  updateProgress();

  try {
    for (const { chunk, index } of needUpload) {
      while (container.isPaused) {
        await new Promise(r => setTimeout(r, 100));
      }

      const form = new FormData();
      form.append('file', chunk);
      form.append('name', `${container.file!.name}-${index}`);
      
      await axios.post(`${API_BASE}/upload`, form);
      success++;
      updateProgress();
    }

    await axios.post(`${API_BASE}/merge`, {
      fileName: container.file.name,
      folderId: currentFolderId.value || null,
      fileHash: fileHash.value || ''
    });

    container.uploadProgress = 100;
    setTimeout(() => {
      container.isShowProgress = false;
      container.uploadProgress = 0;
      container.uploading = false;
      container.file = null;
      fileHash.value = '';
      refreshFileList();
    }, 500);

  } catch (error) {
    console.error('上传失败:', error);
    alert('上传失败！');
    container.isShowProgress = false;
    container.uploading = false;
    fileHash.value = '';
  }
};

// 预览文件
const handlePreview = (file: any) => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const token = localStorage.getItem('token');

  if (!token) {
    alert('登录已失效，请重新登录');
    return;
  }

  const url = `${API_BASE}/api/file/preview?fileId=${file.id}&token=${encodeURIComponent(token)}`;

  // 视频
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) {
    openPreviewModal(`<video controls autoplay style="max-width:100%;max-height:85vh" src="${url}"></video>`);
  }
  // 图片
  else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) {
    openPreviewModal(`<img src="${url}" style="max-width:100%;max-height:85vh;object-fit:contain" />`);
  }
  // PDF
  else if (ext === 'pdf') {
    openPreviewModal(`<iframe src="${url}" style="width:100%;height:85vh;border:none"></iframe>`);
  }
  // 音频
  else if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
    openPreviewModal(`<audio controls autoplay src="${url}"></audio>`);
  }
  else {
    alert(`「${file.name}」\n\n该文件类型不支持在线预览`);
  }
};

// 预览弹窗
const openPreviewModal = (html: string) => {
  // 移除已有的预览弹窗
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

  // ESC 关闭
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
    }
  };
  document.addEventListener('keydown', onKeydown);
};

// 下载文件
const handleDownload = async (file: any) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      `${API_BASE}/download/${encodeURIComponent(file.name)}`,
      {
        responseType: 'blob',  // 必须设置响应类型为 blob
        headers: {
          Authorization: `Bearer ${token}`  // 手动携带 Token
        }
      }
    );

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error('下载失败:', error);
    alert('下载失败，请检查登录状态');
  }
};
// 删除文件
const handleDelete = async (item: any) => {
  if (!confirm(`确定删除 "${item.name}" 吗？`)) return;
  try {
    if (item.type === 'folder') {
      // 删除文件夹
      await axios.delete(`${API_BASE}/folders/${item.id}`);
    } else {
      // 删除文件
      await axios.delete(`${API_BASE}/delete/${encodeURIComponent(item.name)}`);
    }
    refreshFileList();
  } catch (error) {
    console.error('删除失败:', error);
    alert('删除失败');
  }
};

// 页面初始化
onMounted(() => {
  checkLogin();
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

.hash-checking {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 0;
  color: #646A73;
  font-size: 14px;
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

.hidden-file-input {
  display: none;
}

.progress-overlay {
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

.progress-modal {
  background: white;
  border-radius: 12px;
  padding: 32px;
  width: 400px;
  text-align: center;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  font-size: 16px;
  font-weight: 600;
}

.progress-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}

.progress-bar-container {
  height: 8px;
  background: #E5E6EB;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4A90D9, #357ABD);
  border-radius: 4px;
  transition: width 0.3s;
}

.progress-text {
  font-size: 14px;
  color: #646A73;
  margin-bottom: 16px;
}

.progress-pause-btn {
  padding: 8px 24px;
  background: #F5F7FA;
  border: 1px solid #E5E6EB;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.progress-pause-btn:hover {
  background: #E5E6EB;
}

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