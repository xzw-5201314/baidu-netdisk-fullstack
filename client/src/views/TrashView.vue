<!-- views/TrashView.vue — 回收站页 -->
<template>
  <div class="trash-view">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <button class="btn btn-back" @click="router.push('/')">
          <span class="btn-icon">←</span>
          <span class="btn-text">返回</span>
        </button>
        <button class="btn btn-danger" @click="trashStore.handleClearTrash">
          <span class="btn-icon">🗑️</span>
          <span class="btn-text">清空回收站</span>
        </button>
      </div>
      <div class="toolbar-right">
        <span class="trash-count">共 {{ trashStore.trashList.length }} 项</span>
      </div>
    </div>

    <!-- 面包屑 -->
    <div class="breadcrumb">
      <div class="breadcrumb-item active">回收站</div>
    </div>

    <!-- 内容区 -->
    <div class="content-body">
      <FileList
        :files="trashStore.trashList"
        :selected-ids="[]"
        view-mode="list"
        :is-trash-mode="true"
        @restore="trashStore.handleRestore"
        @permanent-delete="trashStore.handlePermanentDelete"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTrashStore } from '../stores/useTrashStore';
import FileList from '../components/FileList.vue';

const router = useRouter();
const trashStore = useTrashStore();

onMounted(() => {
  trashStore.getTrashList();
});
</script>

<style scoped>
.trash-view {
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

.btn-danger {
  background: #F5222D;
  color: white;
}

.btn-danger:hover {
  background: #D91828;
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

.breadcrumb {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #E5E6EB;
  font-size: 14px;
}

.breadcrumb-item {
  color: #1F2329;
  font-weight: 500;
}
</style>
