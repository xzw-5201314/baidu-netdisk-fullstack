<!-- src/components/TransferList.vue -->
<template>
  <div class="transfer-list">
    <!-- Tab 切换 -->
    <div class="transfer-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.count > 0" class="tab-badge">{{ tab.count }}</span>
      </button>
    </div>

    <!-- 列表 -->
    <div class="transfer-items" v-if="filteredTransfers.length > 0">
      <div
        v-for="item in filteredTransfers"
        :key="item.id"
        class="transfer-item"
      >
        <div class="transfer-icon">
          <template v-if="item.type === 'upload'">📤</template>
          <template v-else>📥</template>
        </div>
        <div class="transfer-info">
          <div class="transfer-name">{{ item.fileName }}</div>
          <div class="transfer-meta">
            <span class="transfer-size">{{ formatSize(item.fileSize) }}</span>
            <span v-if="item.speed && item.status === 'transferring'" class="transfer-speed">{{ item.speed }}</span>
            <span class="transfer-status" :class="item.status">{{ statusText(item) }}</span>
          </div>
          <!-- 进度条 -->
          <div v-if="item.status === 'transferring' || item.status === 'paused'" class="progress-bar">
            <div class="progress-fill" :style="{ width: item.progress + '%' }"></div>
          </div>
        </div>
        <div class="transfer-actions">
          <button
            v-if="item.status === 'completed' || item.status === 'failed'"
            class="action-btn"
            @click="$emit('remove', item.id)"
            title="移除"
          >✕</button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="transfer-empty">
      <div class="empty-icon">📤</div>
      <div class="empty-text">暂无传输记录</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface TransferItem {
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

const props = defineProps<{
  transfers: TransferItem[];
}>();

defineEmits(['remove']);

const activeTab = ref('all');

const tabs = computed(() => {
  const transferring = props.transfers.filter(t => t.status === 'transferring' || t.status === 'pending' || t.status === 'paused').length;
  const completed = props.transfers.filter(t => t.status === 'completed').length;
  return [
    { key: 'all', label: '全部', count: props.transfers.length },
    { key: 'active', label: '传输中', count: transferring },
    { key: 'completed', label: '已完成', count: completed },
  ];
});

const filteredTransfers = computed(() => {
  if (activeTab.value === 'active') {
    return props.transfers.filter(t => t.status === 'transferring' || t.status === 'pending' || t.status === 'paused');
  }
  if (activeTab.value === 'completed') {
    return props.transfers.filter(t => t.status === 'completed' || t.status === 'failed');
  }
  return props.transfers;
});

const statusText = (item: TransferItem) => {
  switch (item.status) {
    case 'pending': return '等待中';
    case 'transferring': return item.type === 'upload' ? '上传中' : '下载中';
    case 'paused': return '已暂停';
    case 'completed': return item.type === 'upload' ? '上传完成' : '下载完成';
    case 'failed': return '失败';
    default: return '';
  }
};

const formatSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '';
  if (bytes > 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
};
</script>

<style scoped>
.transfer-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.transfer-tabs {
  display: flex;
  gap: 4px;
  padding: 16px 20px;
  border-bottom: 1px solid #E5E6EB;
  background: white;
}

.tab-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 16px;
  background: #F5F7FA;
  color: #646A73;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-btn:hover {
  background: #E5E6EB;
}

.tab-btn.active {
  background: #4A90D9;
  color: white;
}

.tab-badge {
  font-size: 11px;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 9px;
  background: rgba(0,0,0,0.1);
  padding: 0 4px;
}

.tab-btn.active .tab-badge {
  background: rgba(255,255,255,0.3);
}

.transfer-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.transfer-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  transition: background 0.15s;
}

.transfer-item:hover {
  background: #F8FAFC;
}

.transfer-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.transfer-info {
  flex: 1;
  min-width: 0;
}

.transfer-name {
  font-size: 14px;
  color: #1F2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.transfer-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
}

.transfer-size {
  color: #999;
}

.transfer-speed {
  color: #4A90D9;
}

.transfer-status {
  color: #999;
}

.transfer-status.completed {
  color: #52C41A;
}

.transfer-status.failed {
  color: #F5222D;
}

.transfer-status.paused {
  color: #FAAD14;
}

.progress-bar {
  height: 4px;
  background: #E5E6EB;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4A90D9, #357ABD);
  border-radius: 2px;
  transition: width 0.3s;
}

.transfer-actions {
  flex-shrink: 0;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 6px;
  border-radius: 4px;
  color: #999;
  transition: all 0.15s;
}

.action-btn:hover {
  background: #F0F0F0;
  color: #333;
}

.transfer-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
}
</style>
