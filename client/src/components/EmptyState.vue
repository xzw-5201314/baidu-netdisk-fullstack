<!-- src/components/EmptyState.vue -->
<template>
  <div class="empty-state">
    <div class="empty-icon">☁️</div>
    <div class="empty-title">当前目录为空</div>
    <div class="empty-desc">上传你的第一个文件吧</div>
    <div class="empty-actions">
      <button class="empty-btn empty-btn-primary" @click="$emit('upload')">
        <span>📤</span>
        <span>上传文件</span>
      </button>
      <button class="empty-btn empty-btn-secondary" @click="$emit('create-folder')">
        <span>📁</span>
        <span>新建文件夹</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits(['upload', 'create-folder']);
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
}

.empty-icon {
  font-size: 80px;
  opacity: 0.6;
  margin-bottom: 24px;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #1F2329;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 14px;
  color: #999;
  margin-bottom: 32px;
}

.empty-actions {
  display: flex;
  gap: 12px;
}

.empty-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.empty-btn-primary {
  background: #4A90D9;
  color: white;
}

.empty-btn-primary:hover {
  background: #357ABD;
}

.empty-btn-secondary {
  background: #F5F7FA;
  color: #646A73;
  border: 1px solid #E5E6EB;
}

.empty-btn-secondary:hover {
  background: #E5E6EB;
}
</style>
