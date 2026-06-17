import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { API_BASE } from '../config/api';
import type { ShareItem, FileItem } from '../types/file';

export const useShareStore = defineStore('share', () => {
  // 分享对话框状态
  const showShareDialog = ref(false);
  const shareTargetId = ref('');
  const shareType = ref<'file' | 'folder'>('file');
  const shareName = ref('');

  // 我的分享列表
  const myShares = ref<ShareItem[]>([]);

  // 点击分享按钮
  const handleShare = (file: FileItem) => {
    shareTargetId.value = file.id;
    shareType.value = file.type === 'folder' ? 'folder' : 'file';
    shareName.value = file.name;
    showShareDialog.value = true;
  };

  // 获取我的分享列表
  const getMyShares = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/shares`);
      if (res.data.code === 200) {
        myShares.value = res.data.data;
      } else {
        myShares.value = [];
      }
    } catch (error) {
      console.error('获取分享列表失败:', error);
      myShares.value = [];
    }
  };

  // 取消分享
  const handleRevokeShare = async (share: ShareItem) => {
    if (!confirm(`确定取消对 "${share.shareName}" 的分享吗？`)) return;
    try {
      await axios.delete(`${API_BASE}/api/share/${share.id}`);
      ElMessage.success('已取消分享');
      await getMyShares();
    } catch (error: any) {
      ElMessage.error(error.response?.data?.msg || '取消分享失败');
    }
  };

  return {
    showShareDialog,
    shareTargetId,
    shareType,
    shareName,
    myShares,
    handleShare,
    getMyShares,
    handleRevokeShare
  };
});
