<!-- src/components/MoveDialog.vue -->
<template>
  <div class="dialog-overlay" v-if="visible" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialog-header">
        <h3>移动到...</h3>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="folder-tree">
        <div v-if="loading" class="loading">加载中...</div>
        <template v-else>
          <!-- 根目录选项 -->
          <div
            class="root-item"
            :class="{ active: selectedId === null }"
            @click="selectedId = null"
          >
            <span class="root-icon">📂</span>
            <span>全部文件（根目录）</span>
          </div>
          <!-- 树形文件夹，懒加载 -->
          <FolderTreeItem
            v-for="folder in rootFolders"
            :key="folder._id"
            :folder="folder"
            :level="0"
            :model-value="selectedId"
            @update:model-value="(val) => selectedId = val"
          />
          <!-- 根目录文件 -->
          <div
            v-for="file in rootFiles"
            :key="file.id"
            class="root-file-item"
          >
            <span class="root-file-icon">📄</span>
            <span class="root-file-name">{{ file.name }}</span>
          </div>
        </template>
      </div>

      <div class="dialog-footer">
        <div class="selected-info">
          <template v-if="selectedId === null">移动到：根目录</template>
          <template v-else>已选择目标文件夹</template>
        </div>
        <div class="footer-buttons">
          <button class="btn-cancel" @click="$emit('close')">取消</button>
          <button
            class="btn-confirm"
            :disabled="loading"
            @click="confirmMove"
          >
            {{ loading ? '移动中...' : '确认移动' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { API_BASE } from '../config/api';
import FolderTreeItem from './FolderTreeItem.vue';

const props = defineProps({
  visible: Boolean,
  modelValue: {
    type: [String, null],
    default: null
  },
  moveType: {
    type: String,
    default: 'file'
  },
  moveId: String
});

const emit = defineEmits(['close', 'confirm', 'update:modelValue']);

const rootFolders = ref([]);
const rootFiles = ref([]);
const selectedId = ref(null);
const loading = ref(false);

const fetchRoot = async () => {
  loading.value = true;
  try {
    const [folderRes, fileRes] = await Promise.all([
      axios.get(`${API_BASE}/folders?parentId=null`),
      axios.get(`${API_BASE}/files`)
    ]);
    if (folderRes.data.code === 200) {
      rootFolders.value = folderRes.data.data;
    }
    if (fileRes.data.code === 200) {
      rootFiles.value = fileRes.data.data;
    }
  } catch (error) {
    console.error('获取内容失败:', error);
    rootFolders.value = [];
    rootFiles.value = [];
  } finally {
    loading.value = false;
  }
};

const confirmMove = async () => {
  loading.value = true;
  try {
    if (props.moveType === 'file') {
      await axios.post(`${API_BASE}/files/move`, {
        fileId: props.moveId,
        folderId: selectedId.value
      });
    } else {
      await axios.patch(`${API_BASE}/api/folders/${props.moveId}`, {
        parentId: selectedId.value
      });
    }
    emit('confirm');
  } catch (error) {
    ElMessage.error(error.response?.data?.msg || '移动失败');
  } finally {
    loading.value = false;
  }
};

watch(() => props.visible, (val) => {
  if (val) {
    selectedId.value = null;
    fetchRoot();
  }
});
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 8px;
  width: 420px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e8e8e8;
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #999;
  padding: 4px;
}

.close-btn:hover {
  color: #666;
}

.folder-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  min-height: 100px;
  max-height: 340px;
}

.root-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
  margin-bottom: 4px;
}

.root-item:hover {
  background: #f0f0f0;
}

.root-item.active {
  background: #e6f7ff;
  color: #1890ff;
}

.root-icon {
  font-size: 14px;
}

.root-file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  padding-left: 36px;
  color: #999;
  font-size: 13px;
}

.root-file-icon {
  font-size: 14px;
}

.root-file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loading, .empty {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 13px;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid #e8e8e8;
}

.selected-info {
  font-size: 13px;
  color: #666;
}

.footer-buttons {
  display: flex;
  gap: 12px;
}

.btn-cancel, .btn-confirm {
  padding: 6px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 14px;
}

.btn-cancel {
  background: #f5f5f5;
  color: #666;
}

.btn-cancel:hover {
  background: #e8e8e8;
}

.btn-confirm {
  background: #1890ff;
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  background: #40a9ff;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
