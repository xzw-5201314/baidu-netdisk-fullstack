<!-- src/components/FolderTreeItem.vue -->
<template>
  <div class="tree-node">
    <div
      class="node-content"
      :style="{ paddingLeft: (level * 20) + 'px' }"
      :class="{ active: modelValue === folder._id }"
      @click.stop="handleSelect"
    >
      <span
        class="arrow"
        :class="{ expanded, loading: isLoading }"
        @click.stop="toggleExpand"
      >▶</span>
      <span class="icon">📁</span>
      <span class="name">{{ folder.name }}</span>
    </div>

    <div v-if="expanded">
      <!-- 子文件夹 -->
      <FolderTreeItem
        v-for="child in children"
        :key="child._id"
        :folder="child"
        :level="level + 1"
        :model-value="modelValue"
        @update:model-value="(val) => emit('update:modelValue', val)"
      />
      <!-- 文件（不可选中） -->
      <div
        v-for="file in files"
        :key="file.id"
        class="file-item"
        :style="{ paddingLeft: ((level + 1) * 20) + 'px' }"
      >
        <span class="arrow-placeholder"></span>
        <span class="icon">📄</span>
        <span class="name">{{ file.name }}</span>
      </div>
      <div v-if="!isLoading && children.length === 0 && files.length === 0" class="empty-sub" :style="{ paddingLeft: ((level + 1) * 20 + 24) + 'px' }">
        暂无内容
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { API_BASE } from '../config/api';

defineOptions({ name: 'FolderTreeItem' });

const props = defineProps({
  folder: Object,
  level: Number,
  modelValue: [String, Object]
});

const emit = defineEmits(['update:modelValue']);

const expanded = ref(false);
const isLoading = ref(false);
const children = ref([]);
const files = ref([]);
const loaded = ref(false);

const toggleExpand = async () => {
  if (!loaded.value) {
    isLoading.value = true;
    try {
      const [folderRes, fileRes] = await Promise.all([
        axios.get(`${API_BASE}/folders?parentId=${props.folder._id}`),
        axios.get(`${API_BASE}/files?folderId=${props.folder._id}`)
      ]);
      if (folderRes.data.code === 200) {
        children.value = folderRes.data.data;
      }
      if (fileRes.data.code === 200) {
        files.value = fileRes.data.data;
      }
      loaded.value = true;
    } catch (e) {
      console.error('加载内容失败:', e);
    } finally {
      isLoading.value = false;
    }
  }
  expanded.value = !expanded.value;
};

const handleSelect = () => {
  emit('update:modelValue', props.folder._id);
};
</script>

<style scoped>
.tree-node {
  user-select: none;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.node-content:hover {
  background: #f0f0f0;
}

.node-content.active {
  background: #e6f7ff;
  color: #1890ff;
}

.arrow {
  font-size: 10px;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
  flex-shrink: 0;
  color: #999;
}

.arrow.expanded {
  transform: rotate(90deg);
}

.arrow.loading {
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(405deg); }
}

.icon {
  font-size: 14px;
  cursor: pointer;
}

.name {
  font-size: 13px;
  cursor: pointer;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  color: #999;
}

.arrow-placeholder {
  width: 16px;
  flex-shrink: 0;
}

.empty-sub {
  font-size: 12px;
  color: #bbb;
  padding: 4px 8px;
}
</style>