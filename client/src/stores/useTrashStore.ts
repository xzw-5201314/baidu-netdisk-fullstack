import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { API_BASE } from '../config/api';
import type { TrashItem } from '../types/file';

export const useTrashStore = defineStore('trash', () => {
  const trashList = ref<TrashItem[]>([]);

  // 获取回收站列表
  const getTrashList = async () => {
    try {
      const res = await axios.get(`${API_BASE}/trash`);
      if (res.data.code === 200) {
        trashList.value = res.data.data.map((item: TrashItem) => ({
          ...item,
          time: item.deleteTime || ''
        }));
      } else {
        trashList.value = [];
      }
    } catch (error) {
      console.error('获取回收站失败:', error);
      trashList.value = [];
    }
  };

  // 还原文件/文件夹
  const handleRestore = async (item: TrashItem) => {
    try {
      await axios.post(`${API_BASE}/trash/restore/${item.id}`, { type: item.type });
      ElMessage.success(`"${item.name}" 已还原`);
      await getTrashList();
    } catch (error: any) {
      ElMessage.error(error.response?.data?.msg || '还原失败');
    }
  };

  // 彻底删除
  const handlePermanentDelete = async (item: TrashItem) => {
    if (!confirm(`确定彻底删除 "${item.name}" 吗？此操作不可恢复！`)) return;
    try {
      await axios.delete(`${API_BASE}/trash/${item.id}?type=${item.type}`);
      ElMessage.success(`"${item.name}" 已彻底删除`);
      await getTrashList();
    } catch (error: any) {
      ElMessage.error(error.response?.data?.msg || '彻底删除失败');
    }
  };

  // 清空回收站
  const handleClearTrash = async () => {
    if (!confirm('确定清空回收站吗？所有文件将被彻底删除，此操作不可恢复！')) return;
    try {
      await axios.delete(`${API_BASE}/trash/clear/all`);
      ElMessage.success('回收站已清空');
      await getTrashList();
    } catch (error: any) {
      ElMessage.error(error.response?.data?.msg || '清空失败');
    }
  };

  return {
    trashList,
    getTrashList,
    handleRestore,
    handlePermanentDelete,
    handleClearTrash
  };
});
