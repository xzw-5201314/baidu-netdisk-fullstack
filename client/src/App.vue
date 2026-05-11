<template>
  <div class="app">
    <!-- 登录页面 -->
    <Login v-if="!isLoggedIn" @login-success="handleLoginSuccess" />
    
    <!-- 主页面 -->
    <template v-else>
      <Header :username="username" @logout="handleLogout" />
      
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
            <EmptyState 
              v-if="container.fileList.length === 0"
              @upload="handleUploadClick"
              @create-folder="handleCreateFolder"
            />
            <FileList 
              v-else
              :files="displayFiles" 
              :selected-ids="selectedIds"
              :view-mode="viewMode"
              @preview="handlePreview"
              @download="handleDownload"
              @move="handleMove"
              @delete="handleDelete"
              @select-change="handleSelectChange"
              @enter-folder="enterFolder"
              @confirm-create="confirmCreateFolder"
              @cancel-create="cancelCreate"
            />
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
    
    <!-- 上传进度条 -->
    <div v-if="container.isShowProgress" class="progress-overlay">
      <div class="progress-modal">
        <div class="progress-header">
          <span>上传中...</span>
          <button class="progress-close" @click="cancelUpload">✕</button>
        </div>
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue';
import axios from 'axios';
import Login from './components/Login.vue';
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


// 2. 添加分类映射
const categoryMap: Record<string, string[]> = {
  video: ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv'],
  music: ['mp3', 'wav', 'flac', 'aac', 'ogg','mgg'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
  doc: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'],
};

// 3. 过滤后的文件列表
const displayFiles = computed(() => {
  // 如果不在根目录（有子文件夹路径），显示所有文件
  if (currentFolderId.value !== null) {
    return container.fileList;
  }
  
  // 在根目录时，按分类过滤
  if (currentCategory.value === 'all') {
    return container.fileList;
  }
  
  // 如果是"其他"分类，显示不在任何分类中的文件
  if (currentCategory.value === 'other') {
    const allDefinedExts = Object.values(categoryMap).flat();
    return container.fileList.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return !allDefinedExts.includes(ext || '');
    });
  }
  
  // 按分类过滤
  const exts = categoryMap[currentCategory.value] || [];
  return container.fileList.filter(file => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    return exts.includes(ext || '');
  });
});

// 4. 处理分类变化
const handleCategoryChange = (category: string) => {
  currentCategory.value = category;
};

// 检查登录状态
const checkLogin = async () => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const res = await axios.get('http://localhost:3000/verify', {
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
  await getFileList(currentFolderId.value);
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
const getFileList = async (folderId?: string | null) => {
  try {
    // 获取文件列表
    const filesRes = await axios.get(folderId 
      ? `http://localhost:3000/files?folderId=${folderId}`
      : 'http://localhost:3000/files'
    );

    // 获取文件夹列表（传递 parentId 参数）
    const foldersRes = await axios.get(folderId 
      ? `http://localhost:3000/folders?parentId=${folderId}`
      : 'http://localhost:3000/folders?parentId=null'
    );

    // 处理文件夹数据
    const folders = foldersRes.data.code === 200 
      ? foldersRes.data.data.map((folder: any) => ({
          id: folder.id || folder._id,
          name: folder.name,
          type: 'folder',
          size: '0 KB',
          time: ''
        }))
      : [];

    // 处理文件数据
    const files = filesRes.data.code === 200 
      ? filesRes.data.data.map((file: any) => ({
          ...file,
          type: 'file'
        }))
      : [];

    // 合并并排序（文件夹优先）
    container.fileList = [...folders, ...files];
    calculateStorage();
  } catch (error) {
    console.error('获取列表失败:', error);
    // 失败时只获取文件
    const res = await axios.get(folderId 
      ? `http://localhost:3000/files?folderId=${folderId}`
      : 'http://localhost:3000/files'
    );
    if (res.data.code === 200) {
      container.fileList = res.data.data.map((file: any) => ({
        ...file,
        type: 'file'
      }));
      calculateStorage();
    }
  }
};

// 进入文件夹
const enterFolder = async (folder: any) => {
  currentFolderId.value = folder.id;
  currentPath.value.push({ id: folder.id, name: folder.name });
  await getFileList(folder.id);
};

// 返回上级
const goBack = async () => {
  if (currentPath.value.length > 1) {
    currentPath.value.pop();
    const lastPath = currentPath.value[currentPath.value.length - 1];
    currentFolderId.value = lastPath.id;
    await getFileList(lastPath.id);
  }
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

// 导航切换
const handleNavChange = (nav: string) => {
  currentNav.value = nav;
  if (nav === 'all') {
    getFileList();
  }
};

// 分类切换（已在前面定义）

// 视图切换
const handleViewChange = (view: string) => {
  viewMode.value = view;
};

// 排序切换
const handleSortChange = (sort: string) => {
  console.log('排序:', sort);
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
    await axios.post('http://localhost:3000/folders', {
      name: name,
      parentId: currentFolderId.value || null
    });
    // 重新获取列表
    await getFileList(currentFolderId.value);
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
  const res = await axios.get(`http://localhost:3000/check-chunks/${encodeURIComponent(fileName)}`);
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
    await handleUpload();
  }
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
      
      await axios.post('http://localhost:3000/upload', form);
      success++;
      updateProgress();
    }

    await axios.post('http://localhost:3000/merge', {
      fileName: container.file.name,
      folderId: currentFolderId.value || null
    });

    container.uploadProgress = 100;
    setTimeout(() => {
      container.isShowProgress = false;
      container.uploadProgress = 0;
      container.uploading = false;
      container.file = null;
      getFileList(currentFolderId.value);
    }, 500);

  } catch (error) {
    console.error('上传失败:', error);
    alert('上传失败！');
    container.isShowProgress = false;
    container.uploading = false;
  }
};

// 预览文件
const handlePreview = async (file: any) => {
  try {
    // 检查是否支持预览的文件类型
    const supportedExtensions = ['mp4', 'mov', 'avi', 'png', 'jpg', 'jpeg', 'gif', 'pdf', 'mp3', 'wav', 'ogg', 'flac'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!supportedExtensions.includes(ext)) {
      alert(`「${file.name}」\n\n提示：该文件类型不支持在线预览`);
      return;
    }

    const token = localStorage.getItem('token');
    const response = await fetch(
      `http://localhost:3000/target/${encodeURIComponent(file.name)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('文件获取失败');
    }

    // 使用流式传输，浏览器自动处理边下载边播放
    const blob = await response.blob();
    
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');

  } catch (error) {
    console.error('预览失败:', error);
    alert('预览失败');
  }
};

// 下载文件
const handleDownload = async (file: any) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      `http://localhost:3000/download/${encodeURIComponent(file.name)}`,
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
      await axios.delete(`http://localhost:3000/folders/${item.id}`);
    } else {
      // 删除文件
      await axios.delete(`http://localhost:3000/delete/${encodeURIComponent(item.name)}`);
    }
    getFileList();
  } catch (error) {
    console.error('删除失败:', error);
    alert('删除失败');
  }
};

// 页面初始化
onMounted(() => {
  checkLogin();
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
  min-height: 100vh;
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
</style>