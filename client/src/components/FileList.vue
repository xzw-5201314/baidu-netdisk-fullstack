<!-- src/components/FileList.vue -->
<template>
  <div class="file-list-container">
    <table class="file-table" v-if="viewMode === 'list'">
      <thead>
        <tr>
          <th>
            <input 
              type="checkbox" 
              :checked="isAllSelected"
              @change="toggleSelectAll"
            />
          </th>
          <th class="col-name">文件名</th>
          <th class="col-time">修改时间</th>
          <th class="col-size">大小</th>
          <th class="col-actions">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="file in files" :key="file.name" class="file-row">
          <td>
            <input 
              type="checkbox" 
              :checked="selectedIds.includes(file.id)"
              @change="toggleSelect(file.id)"
            />
          </td>
          <td class="col-name">
            <span class="file-icon">{{ getFileIcon(file) }}</span>
            <template v-if="file.isEditing">
              <div class="inline-edit-wrapper">
                <input 
                  v-model="file.name" 
                  class="inline-edit-input" 
                  placeholder="请输入文件夹名称"
                  @keyup.enter="$emit('confirm-create', file.name)"
                  @keyup.escape="$emit('cancel-create')"
                  v-focus
                />
                <div class="inline-actions">
                  <span class="confirm-icon" @click="$emit('confirm-create', file.name)">✓</span>
                  <span class="cancel-icon" @click="$emit('cancel-create')">✕</span>
                </div>
              </div>
            </template>
            <span 
              v-else
              :class="['file-name', { 'folder-link': file.type === 'folder' }]"
              @click="file.type === 'folder' && $emit('enter-folder', file)"
            >{{ file.name }}</span>
          </td>
          <td class="col-time">{{ file.time }}</td>
          <td class="col-size">{{ file.size }}</td>
          <td class="col-actions">
            <button class="action-btn" @click="$emit('preview', file)">👁️</button>
            <button class="action-btn" @click="$emit('download', file)">⬇️</button>
            <button class="action-btn" @click="$emit('move', file)">📋</button>
            <button class="action-btn" @click="$emit('delete', file)">🗑️</button>
          </td>
        </tr>
      </tbody>
    </table>
    
    <div class="file-grid" v-else>
      <div 
        v-for="file in files" 
        :key="file.name" 
        class="file-card"
      >
        <input 
          type="checkbox" 
          :checked="selectedIds.includes(file.id)"
          @change="toggleSelect(file.id)"
          class="card-checkbox"
        />
        <div 
          :class="['card-icon', { 'folder-icon': file.type === 'folder' }]"
          @click="file.type === 'folder' && $emit('enter-folder', file)"
        >{{ getFileIcon(file) }}</div>
        <div 
          :class="['card-name', { 'folder-link': file.type === 'folder' }]"
          @click="file.type === 'folder' && $emit('enter-folder', file)"
        >{{ file.name }}</div>
        <div class="card-meta">{{ file.size }} · {{ file.time }}</div>
        <div class="card-actions">
          <button class="card-action-btn" @click="$emit('preview', file)">👁️</button>
          <button class="card-action-btn" @click="$emit('download', file)">⬇️</button>
          <button class="card-action-btn" @click="$emit('move', file)">📋</button>
          <button class="card-action-btn" @click="$emit('delete', file)">🗑️</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  files: any[];
  selectedIds: string[];
  viewMode: string;
}>();

const emit = defineEmits(['preview', 'download', 'move', 'delete', 'select-change', 'enter-folder', 'confirm-create', 'cancel-create']);

// 自定义指令：自动聚焦
const vFocus = {
  mounted: (el: HTMLElement) => el.focus()
};

const isAllSelected = computed(() => {
  return props.files.length > 0 && props.files.every(f => props.selectedIds.includes(f.id));
});

const toggleSelectAll = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.checked) {
    emit('select-change', props.files.map(f => f.id));
  } else {
    emit('select-change', []);
  }
};

const toggleSelect = (id: string) => {
  const newIds = props.selectedIds.includes(id)
    ? props.selectedIds.filter(i => i !== id)
    : [...props.selectedIds, id];
  emit('select-change', newIds);
};

const getFileIcon = (file: any) => {
  // 如果是文件夹，返回文件夹图标
  if (file.type === 'folder') {
    return '📁';
  }
  
  const ext = file.name.split('.').pop()?.toLowerCase();
  const icons: Record<string, string> = {
    'mp4': '🎬', 'mov': '🎬', 'avi': '🎬', 'mkv': '🎬',
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'bmp': '🖼️',
    'mp3': '🎵', 'wav': '🎵', 'flac': '🎵',
    'pdf': '📕', 'doc': '📘', 'docx': '📘', 'xls': '📗', 'xlsx': '📗', 'ppt': '📙', 'pptx': '📙',
    'zip': '📦', 'rar': '📦', '7z': '📦',
    'txt': '📝',
  };
  return icons[ext || ''] || '📄';
};
</script>

<style scoped>
.file-list-container {
  flex: 1;
  overflow-y: auto;
}

.file-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}

.file-table th {
  padding: 10px 20px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  color: #646A73;
  background: #F5F7FA;
  border-bottom: 1px solid #E5E6EB;
}

.file-table td {
  padding: 10px 20px;
  border-bottom: 1px solid #F0F1F5;
  vertical-align: middle;
  white-space: nowrap;
  text-align: left;
}

.file-table th:first-child,
.file-table td:first-child {
  width: 40px;
  padding-left: 16px;
  position: sticky;
  left: 0;
  background: inherit;
}

.file-row:hover {
  background: #F8FAFC;
}

.col-name {
  width: 50%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
}

.col-time {
  width: 160px;
  text-align: right;
}

.col-size {
  width: 100px;
  text-align: right;
}

.col-actions {
  width: 120px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.file-icon {
  flex-shrink: 0;
  width: 24px;
  font-size: 18px;
  text-align: center;
  margin-right: 8px;
}

.folder-link {
  cursor: pointer;
  color: #4A90D9;
}

.folder-link:hover {
  text-decoration: underline;
}

.folder-icon {
  cursor: pointer;
}

.inline-edit-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.inline-edit-input {
  flex: 1;
  border: 1px solid #4A90D9;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 14px;
  outline: none;
  background: white;
}

.inline-actions {
  display: flex;
  gap: 4px;
}

.confirm-icon, .cancel-icon {
  cursor: pointer;
  font-size: 16px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.confirm-icon {
  color: #52c41a;
}

.cancel-icon {
  color: #ff4d4f;
}

.confirm-icon:hover, .cancel-icon:hover {
  background: #f0f0f0;
}

.file-name {
  font-size: 14px;
  color: #1F2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 6px 8px;
  border-radius: 4px;
  transition: background 0.2s;
  opacity: 0;
}

.file-row:hover .action-btn {
  opacity: 1;
}

.action-btn:hover {
  background: #E5E6EB;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  padding: 20px;
}

.file-card {
  position: relative;
  background: white;
  border: 1px solid #E5E6EB;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.file-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  border-color: #4A90D9;
}

.card-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
}

.card-icon {
  font-size: 40px;
}

.card-icon.folder-icon {
  cursor: pointer;
  transition: transform 0.2s;
}

.card-icon.folder-icon:hover {
  transform: scale(1.1);
}

.card-name {
  font-size: 14px;
  color: #1F2329;
  text-align: center;
  word-break: break-all;
  max-width: 100%;
}

.card-meta {
  font-size: 12px;
  color: #999;
}

.card-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.file-card:hover .card-actions {
  opacity: 1;
}

.card-action-btn {
  background: #F5F7FA;
  border: none;
  border-radius: 4px;
  padding: 6px;
  cursor: pointer;
  font-size: 12px;
}

.card-action-btn:hover {
  background: #E5E6EB;
}
</style>