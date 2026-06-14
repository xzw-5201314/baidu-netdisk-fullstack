import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface TransferItem {
  id: string;
  fileName: string;
  fileSize: number;
  type: 'upload' | 'download';
  status: 'pending' | 'transferring' | 'paused' | 'completed' | 'failed';
  progress: number;
  speed: string;
  startTime: number;
  endTime?: number;
}

const STORAGE_KEY = 'easycloud-transfers';
const MAX_TRANSFER_HISTORY = 100;

export const useTransferStore = defineStore('transfer', () => {
  // 从 localStorage 加载历史记录
  const loadTransfers = (): TransferItem[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const transferList = ref<TransferItem[]>(loadTransfers());
  const activeTransferCount = computed(() =>
    transferList.value.filter(t => t.status === 'transferring' || t.status === 'pending').length
  );

  // 下载控制状态（不持久化）
  const downloadControllers = new Map<string, AbortController>();
  const downloadChunks = new Map<string, Blob[]>();

  // 当前活跃的上传传输ID
  const currentUploadTransferId = ref<string | null>(null);

  // 持久化到 localStorage
  const saveTransfers = () => {
    if (transferList.value.length > MAX_TRANSFER_HISTORY) {
      transferList.value = transferList.value.slice(-MAX_TRANSFER_HISTORY);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transferList.value));
  };

  // 新增传输记录
  const addTransfer = (item: Omit<TransferItem, 'id' | 'startTime' | 'status' | 'progress' | 'speed'>): TransferItem => {
    const transfer: TransferItem = {
      ...item,
      id: 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      status: 'pending',
      progress: 0,
      speed: '',
      startTime: Date.now()
    };
    transferList.value.push(transfer);
    saveTransfers();
    return transfer;
  };

  // 更新传输记录
  const updateTransfer = (id: string, updates: Partial<TransferItem>) => {
    const item = transferList.value.find(t => t.id === id);
    if (item) {
      Object.assign(item, updates);
      saveTransfers();
    }
  };

  // 移除单条记录
  const removeTransfer = (id: string) => {
    transferList.value = transferList.value.filter(t => t.id !== id);
    saveTransfers();
  };

  // 清除已完成/失败的记录
  const clearCompleted = () => {
    transferList.value = transferList.value.filter(
      t => t.status !== 'completed' && t.status !== 'failed'
    );
    saveTransfers();
  };

  return {
    transferList,
    activeTransferCount,
    downloadControllers,
    downloadChunks,
    currentUploadTransferId,
    addTransfer,
    updateTransfer,
    removeTransfer,
    clearCompleted,
    saveTransfers
  };
});
