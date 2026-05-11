<!-- src/components/MoveDialog.vue -->
<template>
  <div class="dialog-overlay" v-if="visible" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialog-header">
        <h3>移动到...</h3>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>
      
      <div class="tree-container">
        <div 
          class="root-item"
          :class="{ active: modelValue === null }"
          @click="selectRoot"
        >
          <span class="icon">📂</span>
          <span class="name">全部文件 (根目录)</span>
        </div>
        
        <div v-if="loading" class="loading">加载中...</div>
        <div v-else-if="treeData.length === 0" class="empty">暂无文件夹</div>
        <FolderTreeItem 
          v-for="rootFolder in treeData" 
          :key="rootFolder._id" 
          :folder="rootFolder" 
          :level="1" 
          :model-value="modelValue"
          @update:model-value="(val) => emit('update:modelValue', val)"
        />
      </div>
      
      <div class="dialog-footer">
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
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import axios from 'axios';
import FolderTreeItem from './FolderTreeItem.vue';

const props = defineProps({
  visible: Boolean,
  modelValue: {
    type: [String, Object],
    default: null
  },
  moveType: {
    type: String,
    default: 'file' // 'file' 或 'folder'
  },
  moveId: String
});

const emit = defineEmits(['close', 'confirm', 'update:modelValue']);

const treeData = ref([]);
const loading = ref(false);

const loadTree = async () => {
  loading.value = true;
  try {
    const res = await axios.get('http://localhost:3000/api/folders/tree');
    if (res.data.code === 200) {
      treeData.value = res.data.data;
    }
  } catch (error) {
    console.error('获取文件夹树失败:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (props.visible) {
    loadTree();
  }
});

watch(() => props.visible, (val) => {
  if (val) {
    loadTree();
  }
});

const selectRoot = () => {
  emit('update:modelValue', null);
};

const confirmMove = async () => {
  loading.value = true;
  try {
    if (props.moveType === 'file') {
      await axios.post('http://localhost:3000/files/move', {
        fileId: props.moveId,
        folderId: props.modelValue
      });
    } else {
      await axios.patch(`http://localhost:3000/api/folders/${props.moveId}`, {
        parentId: props.modelValue
      });
    }
    emit('confirm');
  } catch (error) {
    alert(error.response?.data?.msg || '移动失败');
  } finally {
    loading.value = false;
  }
};
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
  width: 400px;
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

.tree-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.root-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
  margin-bottom: 8px;
}

.root-item:hover {
  background: #f0f0f0;
}

.root-item.active {
  background: #e6f7ff;
  color: #1890ff;
}

.loading, .empty {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 13px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e8e8e8;
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