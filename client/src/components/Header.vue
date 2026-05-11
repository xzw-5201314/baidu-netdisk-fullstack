<!-- src/components/Header.vue -->
<template>
  <header class="header">
    <div class="header-left">
      <div class="logo">
        <span class="logo-icon">☁️</span>
        <span class="logo-text">Easy云盘</span>
      </div>
    </div>
    <div class="header-center">
      <div class="search-box">
        <input type="text" placeholder="输入文件名搜索" v-model="searchText" class="search-input" />
        <button class="search-btn">🔍</button>
      </div>
    </div>
    <div class="header-right">
      <button class="header-btn">🔄</button>
      <button class="header-btn">⚙️</button>
      <div class="user-info">
        <span class="username">{{ username }}</span>
        <div class="avatar">👤</div>
        <button class="logout-btn" @click="handleLogout">退出</button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  username: string;
}>();

const emit = defineEmits(['logout']);

const handleLogout = () => {
  if (confirm('确定要退出登录吗？')) {
    emit('logout');
  }
};

const searchText = ref('');
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 60px;
  background: linear-gradient(135deg, #4A90D9 0%, #357ABD 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.header-left {
  flex: 1;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
}

.header-center {
  flex: 2;
  display: flex;
  justify-content: center;
}

.search-box {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.2);
  border-radius: 24px;
  padding: 0 16px;
  width: 400px;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 10px 12px;
  color: white;
  font-size: 14px;
}

.search-input::placeholder {
  color: rgba(255,255,255,0.7);
}

.search-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.header-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
}

.header-btn {
  background: rgba(255,255,255,0.2);
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  transition: all 0.2s;
}

.header-btn:hover {
  background: rgba(255,255,255,0.3);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.username {
  font-size: 14px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255,255,255,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.logout-btn {
  background: rgba(255,255,255,0.2);
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: rgba(255,255,255,0.3);
}
</style>