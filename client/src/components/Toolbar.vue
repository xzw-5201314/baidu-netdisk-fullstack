<!-- src/components/Toolbar.vue -->
<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <button class="btn btn-primary" @click="$emit('upload')">
        <span class="btn-icon">📤</span>
        <span class="btn-text">上传</span>
      </button>
      <button class="btn btn-success" @click="$emit('create-folder')">
        <span class="btn-icon">📁</span>
        <span class="btn-text">新建文件夹</span>
      </button>
      <button 
        class="btn btn-danger" 
        :disabled="selectedCount === 0"
        @click="$emit('batch-delete')"
      >
        <span class="btn-icon">🗑️</span>
        <span class="btn-text">批量删除</span>
      </button>
      <button class="btn btn-secondary" @click="$emit('more')">
        <span class="btn-icon">⋮</span>
        <span class="btn-text">更多操作</span>
      </button>
    </div>
    <div class="toolbar-right">
      <select class="sort-select" v-model="sortBy" @change="$emit('sort-change', sortBy)">
        <option value="time-desc">修改时间 ↓</option>
        <option value="time-asc">修改时间 ↑</option>
        <option value="name-asc">名称 ↑</option>
        <option value="name-desc">名称 ↓</option>
        <option value="size-desc">大小 ↓</option>
        <option value="size-asc">大小 ↑</option>
      </select>
      <div class="view-toggle">
        <button 
          :class="['view-btn', { active: viewMode === 'list' }]"
          @click="$emit('view-change', 'list')"
        >📋</button>
        <button 
          :class="['view-btn', { active: viewMode === 'grid' }]"
          @click="$emit('view-change', 'grid')"
        >📦</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  selectedCount: number;
  viewMode: string;
}>();

defineEmits(['upload', 'create-folder', 'batch-delete', 'more', 'sort-change', 'view-change']);

const sortBy = ref('time-desc');
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #FFFFFF;
  border-bottom: 1px solid #E5E6EB;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #4A90D9;
  color: white;
}

.btn-primary:hover {
  background: #357ABD;
}

.btn-success {
  background: #52C41A;
  color: white;
}

.btn-success:hover {
  background: #3FB911;
}

.btn-danger {
  background: #F5222D;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #D91828;
}

.btn-secondary {
  background: #F5F7FA;
  color: #646A73;
}

.btn-secondary:hover {
  background: #E5E6EB;
}

.btn-icon {
  font-size: 14px;
}

.btn-text {
  font-size: 13px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sort-select {
  padding: 6px 12px;
  border: 1px solid #E5E6EB;
  border-radius: 4px;
  background: white;
  font-size: 13px;
  color: #646A73;
  cursor: pointer;
}

.sort-select:focus {
  outline: none;
  border-color: #4A90D9;
}

.view-toggle {
  display: flex;
  background: #F5F7FA;
  border-radius: 4px;
  overflow: hidden;
}

.view-btn {
  padding: 6px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.view-btn:hover {
  background: #E5E6EB;
}

.view-btn.active {
  background: white;
  color: #4A90D9;
}
</style>
