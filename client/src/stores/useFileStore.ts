import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { API_BASE } from '../config/api';
import { parseSize, formatSpeed } from '../utils/format';
import { calculateFileHash } from '../utils/hash';
import { createFileChunks } from '../utils/file';
import { useTransferStore } from './useTransferStore';

export const useFileStore = defineStore('file', () => {
  // ==================== 状态 ====================
  const container = reactive({
    file: null as File | null,
    uploadProgress: 0,
    uploading: false,
    fileList: [] as any[],
    isPaused: false,
    isShowProgress: false
  });

  const currentFolderId = ref<string | null>(null);
  const currentPath = ref<{ id: string | null; name: string }[]>([
    { id: null, name: '全部文件' }
  ]);
  const viewMode = ref('list');
  const selectedIds = ref<string[]>([]);
  const renamingId = ref<string | null>(null);
  const sortBy = ref('time-desc');
  const refreshing = ref(false);

  // 存储空间
  const usedSpace = ref('0 GB');
  const totalSpace = ref('15 GB');
  const usedPercent = ref(0);

  // 上传相关状态
  const fileHash = ref('');
  const isCalculatingHash = ref(false);
  const hashProgress = ref(0);
  let uploadCancelled = false;

  // 分类
  const categoryNameMap: Record<string, string> = {
    video: '视频',
    music: '音乐',
    image: '图片',
    doc: '文档',
    other: '其他',
  };

  // ==================== 计算属性 ====================
  const displayFiles = computed(() => container.fileList);

  // ==================== 存储计算 ====================
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

  // ==================== 排序 ====================
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

  // ==================== 获取文件列表 ====================
  const getFileList = async (folderId?: string | null, category?: string) => {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') {
        params.set('category', category);
      } else if (folderId) {
        params.set('folderId', folderId);
      }

      const filesRes = await axios.get(`${API_BASE}/files?${params.toString()}`);

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

      const files = filesRes.data.code === 200
        ? filesRes.data.data.map((file: any) => ({
            ...file,
            type: 'file'
          }))
        : [];

      container.fileList = [...folders, ...files];
      sortFileList();
      calculateStorage();
    } catch (error) {
      console.error('获取列表失败:', error);
    }
  };

  // ==================== 刷新文件列表 ====================
  const refreshFileList = () => {
    return getFileList(currentFolderId.value);
  };

  // ==================== 文件夹导航 ====================
  const enterFolder = async (folder: any) => {
    currentFolderId.value = folder.id;
    currentPath.value.push({ id: folder.id, name: folder.name });
    await getFileList(folder.id);
  };

  const goToPath = async (index: number) => {
    currentPath.value = currentPath.value.slice(0, index + 1);
    const targetPath = currentPath.value[index];
    currentFolderId.value = targetPath.id;
    await getFileList(targetPath.id);
  };

  // ==================== 刷新（带动画） ====================
  const handleRefresh = async () => {
    refreshing.value = true;
    selectedIds.value = [];
    await new Promise(r => setTimeout(r, 500));
    await refreshFileList();
    refreshing.value = false;
  };

  // ==================== 文件夹创建 ====================
  const handleCreateFolder = () => {
    if (container.fileList.some(item => item.isEditing)) return;
    container.fileList.unshift({
      id: 'temp-' + Date.now(),
      name: '',
      type: 'folder',
      isEditing: true,
      size: '-',
      time: '-'
    });
  };

  const confirmCreateFolder = async (name: string) => {
    if (!name || name.trim() === '') {
      container.fileList.shift();
      return;
    }
    try {
      await axios.post(`${API_BASE}/folders`, {
        name: name,
        parentId: currentFolderId.value || null
      });
      await refreshFileList();
    } catch (error) {
      alert('创建失败');
      container.fileList.shift();
    }
  };

  const cancelCreate = () => {
    container.fileList.shift();
  };

  // ==================== 重命名 ====================
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

  // ==================== 删除 ====================
  const handleDelete = async (item: any) => {
    if (!confirm(`确定删除 "${item.name}" 吗？`)) return;
    try {
      if (item.type === 'folder') {
        await axios.delete(`${API_BASE}/folders/${item.id}`);
      } else {
        await axios.delete(`${API_BASE}/delete/${encodeURIComponent(item.name)}`);
      }
      refreshFileList();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (!confirm(`确定将选中的 ${selectedIds.value.length} 个项目移入回收站吗？`)) return;
    try {
      for (const id of selectedIds.value) {
        const file = container.fileList.find(f => f.id === id);
        if (!file) continue;
        if (file.type === 'folder') {
          await axios.delete(`${API_BASE}/folders/${file.id}`);
        } else {
          await axios.delete(`${API_BASE}/delete/${encodeURIComponent(file.name)}`);
        }
      }
      selectedIds.value = [];
      await refreshFileList();
    } catch (error) {
      console.error('批量删除失败:', error);
      alert('批量删除失败');
    }
  };

  // ==================== 排序/视图切换 ====================
  const handleSortChange = (sort: string) => {
    sortBy.value = sort;
    sortFileList();
  };

  const handleViewChange = (view: string) => {
    viewMode.value = view;
  };

  const handleSelectChange = (ids: string[]) => {
    selectedIds.value = ids;
  };

  // ==================== 上传 ====================
  const handleUploadClick = () => {
    const input = document.getElementById('file-input') as HTMLInputElement;
    input?.click();
  };

  // 查询后端已上传的分片
  const checkUploadedChunks = async (fileName: string) => {
    const res = await axios.get(`${API_BASE}/check-chunks/${encodeURIComponent(fileName)}`);
    return res.data.data || [];
  };

  // 取消上传
  const cancelUpload = () => {
    uploadCancelled = true;
    const transferStore = useTransferStore();
    if (transferStore.currentUploadTransferId) {
      transferStore.updateTransfer(transferStore.currentUploadTransferId, { status: 'failed', endTime: Date.now() });
      transferStore.currentUploadTransferId = null;
    }
    container.isShowProgress = false;
    container.uploading = false;
    container.isPaused = false;
    container.uploadProgress = 0;
    fileHash.value = '';
    isCalculatingHash.value = false;
    hashProgress.value = 0;
  };

  // 带秒传检查的上传流程
  const handleUploadWithHash = async () => {
    if (!container.file) return;
    uploadCancelled = false;
    const transferStore = useTransferStore();

    // 创建传输记录
    const transfer = transferStore.addTransfer({
      fileName: container.file.name,
      fileSize: container.file.size,
      type: 'upload'
    });
    transferStore.currentUploadTransferId = transfer.id;
    transferStore.updateTransfer(transfer.id, { status: 'transferring' });

    // 1. 计算文件 hash
    isCalculatingHash.value = true;
    try {
      fileHash.value = await calculateFileHash(container.file, (percent) => {
        hashProgress.value = percent;
      });
    } catch {
      fileHash.value = '';
    }
    isCalculatingHash.value = false;
    hashProgress.value = 0;

    if (uploadCancelled) {
      transferStore.updateTransfer(transfer.id, { status: 'failed', endTime: Date.now() });
      transferStore.currentUploadTransferId = null;
      return;
    }

    // 2. 检查是否可以秒传
    if (fileHash.value && container.file) {
      try {
        const res = await axios.post(`${API_BASE}/check-hash`, {
          fileHash: fileHash.value,
          fileName: container.file.name,
          fileSize: container.file.size,
          folderId: currentFolderId.value || null
        });
        if (uploadCancelled) {
          transferStore.updateTransfer(transfer.id, { status: 'failed', endTime: Date.now() });
          transferStore.currentUploadTransferId = null;
          return;
        }
        if (res.data.data?.exists) {
          container.uploadProgress = 100;
          transferStore.updateTransfer(transfer.id, { status: 'completed', progress: 100, endTime: Date.now(), speed: '秒传' });
          transferStore.currentUploadTransferId = null;
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
        if (uploadCancelled) {
          transferStore.updateTransfer(transfer.id, { status: 'failed', endTime: Date.now() });
          transferStore.currentUploadTransferId = null;
          return;
        }
      }
    }

    // 3. 正常上传
    await handleUpload(transfer.id);
  };

  // 上传逻辑
  const handleUpload = async (transferId?: string) => {
    if (!container.file || container.uploading) return;
    container.isShowProgress = true;
    container.uploading = true;
    container.isPaused = false;

    const transferStore = useTransferStore();
    const startTime = Date.now();
    const chunks = createFileChunks(container.file);
    const uploaded = await checkUploadedChunks(container.file.name);
    const needUpload = chunks.filter((_, i) => !uploaded.includes(i));

    let total = chunks.length;
    let success = uploaded.length;

    const updateProgress = (): void => {
      container.uploadProgress = Math.round((success / total) * 100);
      if (transferId) {
        const elapsed = (Date.now() - startTime) / 1000;
        const uploadedBytes = (success / total) * container.file!.size;
        const speed = elapsed > 0 ? uploadedBytes / elapsed : 0;
        transferStore.updateTransfer(transferId, {
          progress: container.uploadProgress,
          speed: formatSpeed(speed)
        });
      }
    };
    updateProgress();

    try {
      for (const { chunk, index } of needUpload) {
        while (container.isPaused) {
          if (transferId) transferStore.updateTransfer(transferId, { status: 'paused' });
          await new Promise(r => setTimeout(r, 100));
        }
        if (transferId) {
          const item = transferStore.transferList.find(t => t.id === transferId);
          if (item && item.status === 'paused') {
            transferStore.updateTransfer(transferId, { status: 'transferring' });
          }
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
      if (transferId) {
        transferStore.updateTransfer(transferId, { status: 'completed', progress: 100, endTime: Date.now() });
      }
      transferStore.currentUploadTransferId = null;
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
      if (transferId) {
        transferStore.updateTransfer(transferId, { status: 'failed', endTime: Date.now() });
      }
      transferStore.currentUploadTransferId = null;
      container.isShowProgress = false;
      container.uploading = false;
      fileHash.value = '';
    }
  };

  // 多文件队列上传
  const uploadFileList = async (fileList: File[]) => {
    for (const file of fileList) {
      container.file = file;
      container.uploadProgress = 0;
      container.uploading = false;
      await handleUploadWithHash();
    }
  };

  // 文件选择
  const handleFileChange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files?.[0]) {
      container.file = target.files[0];
      container.uploadProgress = 0;
      await handleUploadWithHash();
    }
    target.value = '';
  };

  // ==================== 下载 ====================
  const handleDownload = async (file: any, resumeFrom?: { transferId: string, chunks: Blob[], downloadedBytes: number }) => {
    const transferStore = useTransferStore();
    const transferId = resumeFrom?.transferId || '';
    const existingChunks = resumeFrom?.chunks || [];
    const startBytes = resumeFrom?.downloadedBytes || 0;

    let currentTransferId = transferId;
    if (!resumeFrom) {
      const transfer = transferStore.addTransfer({
        fileName: file.name,
        fileSize: 0,
        type: 'download'
      });
      currentTransferId = transfer.id;
      transferStore.updateTransfer(currentTransferId, { status: 'transferring' });
    } else {
      transferStore.updateTransfer(currentTransferId, { status: 'transferring' });
    }

    const controller = new AbortController();
    transferStore.downloadControllers.set(currentTransferId, controller);
    transferStore.downloadChunks.set(currentTransferId, [...existingChunks]);

    const token = localStorage.getItem('token');
    let downloadedBytes = startBytes;
    let totalBytes = 0;
    const startTime = Date.now();
    let lastSpeedTime = startTime;
    let bytesSinceLastSpeed = 0;

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`
      };
      if (startBytes > 0) {
        headers['Range'] = `bytes=${startBytes}-`;
      }

      const response = await fetch(
        `${API_BASE}/download/${encodeURIComponent(file.name)}`,
        { headers, signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentLength = response.headers.get('Content-Length');
      if (startBytes > 0 && response.status === 206) {
        totalBytes = startBytes + (contentLength ? parseInt(contentLength) : 0);
      } else {
        totalBytes = contentLength ? parseInt(contentLength) : 0;
      }

      if (totalBytes > 0) {
        transferStore.updateTransfer(currentTransferId, { fileSize: totalBytes });
      }

      const reader = response.body!.getReader();
      const chunks = [...existingChunks];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(new Blob([value]));
        transferStore.downloadChunks.set(currentTransferId, [...chunks]);
        downloadedBytes += value.byteLength;
        bytesSinceLastSpeed += value.byteLength;

        const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;

        const now = Date.now();
        if (now - lastSpeedTime >= 500) {
          const elapsed = (now - lastSpeedTime) / 1000;
          const speed = bytesSinceLastSpeed / elapsed;
          transferStore.updateTransfer(currentTransferId, { progress, speed: formatSpeed(speed) });
          lastSpeedTime = now;
          bytesSinceLastSpeed = 0;
        } else {
          transferStore.updateTransfer(currentTransferId, { progress });
        }
      }

      transferStore.downloadControllers.delete(currentTransferId);
      transferStore.downloadChunks.delete(currentTransferId);

      const blob = new Blob(chunks);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      transferStore.updateTransfer(currentTransferId, {
        status: 'completed',
        progress: 100,
        endTime: Date.now(),
        speed: ''
      });

    } catch (error: any) {
      transferStore.downloadControllers.delete(currentTransferId);

      if (error.name === 'AbortError') {
        transferStore.updateTransfer(currentTransferId, { status: 'paused', speed: '' });
        return;
      }

      transferStore.downloadChunks.delete(currentTransferId);
      console.error('下载失败:', error);
      transferStore.updateTransfer(currentTransferId, { status: 'failed', endTime: Date.now(), speed: '' });
      ElMessage.error('下载失败');
    }
  };

  // 暂停下载
  const handlePauseDownload = (transferId: string) => {
    const transferStore = useTransferStore();
    const controller = transferStore.downloadControllers.get(transferId);
    if (controller) {
      controller.abort();
    }
  };

  // 继续下载
  const handleResumeDownload = (transfer: any) => {
    const transferStore = useTransferStore();
    const chunks = transferStore.downloadChunks.get(transfer.id) || [];
    const downloadedBytes = chunks.reduce((sum, chunk) => sum + chunk.size, 0);

    handleDownload({ name: transfer.fileName }, {
      transferId: transfer.id,
      chunks,
      downloadedBytes
    });
  };

  // ==================== 重置文件夹导航 ====================
  const resetToRoot = () => {
    currentFolderId.value = null;
    currentPath.value = [{ id: null, name: '全部文件' }];
    selectedIds.value = [];
  };

  return {
    // 状态
    container,
    currentFolderId,
    currentPath,
    viewMode,
    selectedIds,
    renamingId,
    sortBy,
    refreshing,
    usedSpace,
    totalSpace,
    usedPercent,
    fileHash,
    isCalculatingHash,
    hashProgress,
    categoryNameMap,
    displayFiles,
    // 方法
    getFileList,
    refreshFileList,
    enterFolder,
    goToPath,
    handleRefresh,
    handleCreateFolder,
    confirmCreateFolder,
    cancelCreate,
    handleStartRename,
    handleConfirmRename,
    handleCancelRename,
    handleDelete,
    handleBatchDelete,
    handleSortChange,
    handleViewChange,
    handleSelectChange,
    handleUploadClick,
    handleFileChange,
    handleUploadWithHash,
    uploadFileList,
    cancelUpload,
    handleDownload,
    handlePauseDownload,
    handleResumeDownload,
    resetToRoot,
    calculateStorage,
    sortFileList
  };
});
