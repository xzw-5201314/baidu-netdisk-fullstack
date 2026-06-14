<!-- views/TransferView.vue — 传输列表页 -->
<template>
  <div class="transfer-view">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <button class="btn btn-back" @click="router.push('/')">
          <span class="btn-icon">←</span>
          <span class="btn-text">返回</span>
        </button>
        <button class="btn btn-secondary" @click="transferStore.clearCompleted">
          <span class="btn-icon">🧹</span>
          <span class="btn-text">清除已完成</span>
        </button>
      </div>
      <div class="toolbar-right">
        <span class="trash-count">共 {{ transferStore.transferList.length }} 项</span>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="content-body">
      <TransferList
        :transfers="transferStore.transferList"
        @remove="transferStore.removeTransfer"
        @pause="fileStore.handlePauseDownload"
        @resume="fileStore.handleResumeDownload"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useTransferStore } from '../stores/useTransferStore';
import { useFileStore } from '../stores/useFileStore';
import TransferList from '../components/TransferList.vue';

const router = useRouter();
const transferStore = useTransferStore();
const fileStore = useFileStore();
</script>

<style scoped>
.transfer-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

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

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
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

.btn-back {
  background: #F5F7FA;
  color: #646A73;
}

.btn-back:hover {
  background: #E5E6EB;
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

.trash-count {
  font-size: 13px;
  color: #999;
}

.content-body {
  flex: 1;
  overflow-y: auto;
  background: #F5F7FA;
}
</style>
