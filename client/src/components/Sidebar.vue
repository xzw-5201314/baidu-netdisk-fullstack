<!-- src/components/Sidebar.vue -->
<template>
  <aside class="sidebar">
    <div class="sidebar-nav">
      <div
        v-for="item in navItems"
        :key="item.id"
        :class="['nav-item', { active: currentNav === item.id }]"
        @click="$emit('nav-change', item.id)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-text">{{ item.name }}</span>
        <span v-if="item.id === 'transfer' && activeTransferCount > 0" class="nav-badge">{{ activeTransferCount }}</span>
      </div>
    </div>
    
    <div class="sidebar-divider"></div>
    
    <div class="sidebar-categories">
      <div class="category-title">分类</div>
      <div
        v-for="cat in categories"
        :key="cat.id"
        :class="['category-item', { active: currentCategory === cat.id }]"
        @click="$emit('category-change', cat.id)"
      >
        <span class="category-icon">{{ cat.icon }}</span>
        <span class="category-text">{{ cat.name }}</span>
      </div>
    </div>
    
    <div class="sidebar-divider"></div>
    
    <div class="sidebar-bottom">
      <div :class="['nav-item', { active: currentNav === 'recycle' }]" @click="$emit('nav-change', 'recycle')">
        <span class="nav-icon">🗑️</span>
        <span class="nav-text">回收站</span>
      </div>
    </div>
    
    <div class="storage-info">
      <div class="storage-label">空间使用</div>
      <div class="storage-bar">
        <div class="storage-used" :style="{ width: usedPercent + '%' }"></div>
      </div>
      <div class="storage-text">{{ usedSpace }} / {{ totalSpace }}</div>
    </div>
  </aside>
</template>

<script setup lang="ts">
defineProps<{
  currentNav: string;
  currentCategory: string;
  usedSpace?: string;
  totalSpace?: string;
  usedPercent?: number;
  activeTransferCount?: number;
}>();

defineEmits(['nav-change', 'category-change']);

const navItems = [
  { id: 'all', icon: '🏠', name: '首页' },
  { id: 'share', icon: '🔗', name: '分享' },
  { id: 'transfer', icon: '📤', name: '传输' },
];

const categories = [
  { id: 'all', icon: '📁', name: '全部' },
  { id: 'video', icon: '🎬', name: '视频' },
  { id: 'music', icon: '🎵', name: '音乐' },
  { id: 'image', icon: '🖼️', name: '图片' },
  { id: 'doc', icon: '📄', name: '文档' },
  { id: 'other', icon: '📦', name: '其他' },
];
</script>

<style scoped>
.sidebar {
  width: 180px;
  min-width: 140px;
  background: #FFFFFF;
  padding: 12px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  box-shadow: 2px 0 8px rgba(0,0,0,0.05);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #646A73;
}

.nav-item:hover {
  background: #F5F7FA;
  color: #4A90D9;
}

.nav-item.active {
  background: #E8F0FE;
  color: #4A90D9;
}

.nav-icon {
  font-size: 18px;
}

.nav-text {
  font-size: 14px;
}

.nav-badge {
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  font-size: 11px;
  color: white;
  background: #F5222D;
  border-radius: 10px;
  padding: 0 6px;
}

.sidebar-divider {
  height: 1px;
  background: #E5E6EB;
  margin: 16px 0;
}

.sidebar-categories {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-title {
  font-size: 12px;
  color: #999;
  padding: 0 12px;
  margin-bottom: 8px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #646A73;
}

.category-item:hover {
  background: #F5F7FA;
  color: #4A90D9;
}

.category-item.active {
  background: #E8F0FE;
  color: #4A90D9;
}

.category-icon {
  font-size: 16px;
}

.category-text {
  font-size: 13px;
}

.sidebar-bottom {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.storage-info {
  padding-top: 16px;
}

.storage-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.storage-bar {
  height: 6px;
  background: #E5E6EB;
  border-radius: 3px;
  overflow: hidden;
}

.storage-used {
  height: 100%;
  background: linear-gradient(90deg, #4A90D9, #357ABD);
  border-radius: 3px;
  transition: width 0.3s;
}

.storage-text {
  font-size: 12px;
  color: #646A73;
  margin-top: 4px;
}
</style>