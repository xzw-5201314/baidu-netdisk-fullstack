<!-- src/components/FolderTreeItem.vue -->
<template>
  <div class="tree-node">
    <div 
      class="node-content" 
      :style="{ paddingLeft: (level * 20) + 'px' }" 
      :class="{ active: modelValue === folder._id }"
      @click="handleSelect"
    >
      <span class="icon">📁</span>
      <span class="name">{{ folder.name }}</span>
    </div>

    <div v-if="folder.children && folder.children.length">
      <FolderTreeItem 
        v-for="child in folder.children" 
        :key="child._id" 
        :folder="child" 
        :level="level + 1" 
        :model-value="modelValue"
        @update:model-value="(val) => emit('update:modelValue', val)"
      />
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'FolderTreeItem' })

const props = defineProps({
  folder: Object,
  level: Number,
  modelValue: [String, Object]
});
const emit = defineEmits(['update:modelValue']);

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

.icon {
  font-size: 14px;
}

.name {
  font-size: 13px;
}
</style>