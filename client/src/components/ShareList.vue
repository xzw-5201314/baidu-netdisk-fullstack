<!-- src/components/ShareList.vue -->
<template>
  <div class="share-list-container">
    <table class="share-table">
      <thead>
        <tr>
          <th class="col-name">名称</th>
          <th class="col-status">状态</th>
          <th class="col-visits">访问</th>
          <th class="col-downloads">下载</th>
          <th class="col-time">创建时间</th>
          <th class="col-actions-header"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="share in shares" :key="share.id" class="share-row">
          <td class="col-name">
            <span class="share-icon">{{ share.shareType === 'folder' ? '📁' : '📄' }}</span>
            <span class="share-name-text">{{ share.shareName }}</span>
          </td>
          <td class="col-status">
            <span :class="['status-tag', getStatusClass(share)]">
              {{ getStatusText(share) }}
            </span>
          </td>
          <td class="col-visits">{{ share.viewCount }}</td>
          <td class="col-downloads">{{ share.downloadCount }}</td>
          <td class="col-time">{{ formatTime(share.createdAt) }}</td>
          <td class="row-actions">
            <div class="action-bar">
              <button class="action-btn" @click="copyLink(share.shareCode)" title="复制链接">📋</button>
              <button class="action-btn action-btn-danger" @click="$emit('revoke', share)" title="取消分享">🗑️</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="shares.length === 0" class="empty-shares">
      <div class="empty-icon">🔗</div>
      <div class="empty-text">暂无分享</div>
      <div class="empty-hint">选中文件后点击分享按钮创建分享链接</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import type { ShareItem } from '../types/file';

defineProps<{
  shares: ShareItem[];
}>();

defineEmits(['revoke']);

const copyLink = async (code: string) => {
  const link = `${window.location.origin}/s/${code}`;
  try {
    await navigator.clipboard.writeText(link);
    ElMessage.success('链接已复制到剪贴板');
  } catch {
    const input = document.createElement('input');
    input.value = link;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    ElMessage.success('链接已复制到剪贴板');
  }
};

const getStatusClass = (share: ShareItem) => {
  if (share.status === 'expired') return 'status-expired';
  if (share.status === 'revoked') return 'status-revoked';
  if (share.expireAt && new Date(share.expireAt) < new Date()) return 'status-expired';
  return 'status-active';
};

const getStatusText = (share: ShareItem) => {
  if (share.status === 'revoked') return '已取消';
  if (share.status === 'expired') return '已过期';
  if (share.expireAt && new Date(share.expireAt) < new Date()) return '已过期';
  if (share.hasPassword) return '🔒 有效';
  return '有效';
};

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};
</script>

<style scoped>
.share-list-container {
  flex: 1;
  overflow-y: auto;
}

.share-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.share-table th {
  padding: 10px 20px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  color: #646A73;
  background: #F5F7FA;
  border-bottom: 1px solid #E5E6EB;
}

.share-table td {
  padding: 12px 20px;
  border-bottom: 1px solid #F0F1F5;
  vertical-align: middle;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.share-row {
  position: relative;
}

.share-row:hover {
  background: #F8FAFC;
}

.share-row:hover .action-bar {
  opacity: 1;
}

.col-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.share-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.share-name-text {
  font-size: 14px;
  color: #1F2329;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-status {
  width: 80px;
}

.status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-active {
  background: #E6F7E6;
  color: #52c41a;
}

.status-expired {
  background: #FFF2E8;
  color: #FA8C16;
}

.status-revoked {
  background: #F5F5F5;
  color: #999;
}

.col-visits, .col-downloads {
  width: 60px;
  text-align: center;
  font-size: 13px;
  color: #646A73;
}

.col-time {
  width: 100px;
  font-size: 13px;
  color: #646A73;
}

.col-actions-header {
  width: 0;
  padding: 0 !important;
}

.row-actions {
  width: 0;
  padding: 0 !important;
  border: none !important;
}

.action-bar {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 16px;
  background: #F8FAFC;
  border-radius: 4px;
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.15s;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 6px;
  border-radius: 4px;
  transition: background 0.15s;
  position: relative;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

.action-btn-danger:hover {
  background: rgba(245, 34, 45, 0.1);
}

/* 自定义 tooltip */
.action-btn::after {
  content: attr(title);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: white;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
}

.action-btn:hover::after {
  opacity: 1;
}

/* 空状态 */
.empty-shares {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  color: #646A73;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: #999;
}
</style>
