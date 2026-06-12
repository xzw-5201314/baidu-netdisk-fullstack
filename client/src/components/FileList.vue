<!-- src/components/FileList.vue -->
<template>
  <div class="file-list-container">
    <table class="file-table" v-if="viewMode === 'list'">
      <thead>
        <tr>
          <th class="col-check">
            <input
              type="checkbox"
              :checked="isAllSelected"
              @change="toggleSelectAll"
            />
          </th>
          <th class="col-name">文件名</th>
          <th v-if="isTrashMode" class="col-path">原位置</th>
          <th class="col-time">{{ isTrashMode ? '删除时间' : '修改时间' }}</th>
          <th v-if="!isTrashMode" class="col-size">大小</th>
          <th class="col-actions-header"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="file in files"
          :key="file.id"
          class="file-row"
          :class="{ 'folder-row': file.type === 'folder', 'renaming-row': renamingId === file.id }"
          @click="file.type === 'folder' && !isTrashMode && $emit('enter-folder', file)"
        >
          <td class="col-check" @click.stop>
            <input
              type="checkbox"
              :checked="selectedIds.includes(file.id)"
              @change="toggleSelect(file.id)"
            />
          </td>
          <td class="col-name">
            <template v-if="file.isEditing">
              <div class="inline-edit-wrapper" @click.stop>
                <span class="file-icon">{{ getFileIcon(file) }}</span>
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
            <template v-else-if="renamingId === file.id">
              <div class="inline-edit-wrapper" @click.stop>
                <span class="file-icon">{{ getFileIcon(file) }}</span>
                <input
                  v-model="renameValue"
                  class="inline-edit-input"
                  @keyup="onRenameKeyup"
                  @blur="onRenameBlur"
                  v-focus
                />
                <div class="inline-actions">
                  <span class="confirm-icon" @mousedown.prevent="onRenameBtn('confirm')">✓</span>
                  <span class="cancel-icon" @mousedown.prevent="onRenameBtn('cancel')">✕</span>
                </div>
              </div>
            </template>
            <template v-else>
              <span class="file-icon">{{ getFileIcon(file) }}</span>
              <span
                :class="['file-name', { 'folder-link': file.type === 'folder' }]"
                @click="file.type === 'folder' && !isTrashMode && $emit('enter-folder', file)"
              >{{ file.name }}</span>
            </template>
          </td>
          <td v-if="isTrashMode" class="col-path">{{ file.originalPath || '根目录' }}</td>
          <td class="col-time">{{ file.time }}</td>
          <td v-if="!isTrashMode" class="col-size">{{ file.size }}</td>
          <td class="row-actions">
            <div v-if="renamingId !== file.id" class="action-bar" @click.stop>
              <template v-if="isTrashMode">
                <button class="action-btn" @click="$emit('restore', file)" title="还原">♻️</button>
                <button class="action-btn action-btn-danger" @click="$emit('permanent-delete', file)" title="彻底删除">🗑️</button>
              </template>
              <template v-else>
                <button class="action-btn" @click="$emit('preview', file)" title="预览">👁️</button>
                <button class="action-btn" @click="$emit('download', file)" title="下载">⬇️</button>
                <button class="action-btn" @click="$emit('share', file)" title="分享">🔗</button>
                <button class="action-btn" @click="startRename(file)" title="重命名">✏️</button>
                <button class="action-btn" @click="$emit('move', file)" title="移动到">📋</button>
                <button class="action-btn" @click="$emit('delete', file)" title="删除">🗑️</button>
              </template>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    
    <div class="file-grid" v-else>
      <div
        v-for="file in files"
        :key="file.id"
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
          @click="file.type === 'folder' && !isTrashMode && $emit('enter-folder', file)"
        >{{ getFileIcon(file) }}</div>
        <div
          v-if="renamingId === file.id"
          class="card-rename-wrapper"
          @click.stop
        >
          <input
            v-model="renameValue"
            class="card-rename-input"
            @keyup="onRenameKeyup"
            @blur="onRenameBlur"
            v-focus
          />
          <div class="card-rename-actions">
            <span class="confirm-icon" @mousedown.prevent="onRenameBtn('confirm')">✓</span>
            <span class="cancel-icon" @mousedown.prevent="onRenameBtn('cancel')">✕</span>
          </div>
        </div>
        <div
          v-else
          :class="['card-name', { 'folder-link': file.type === 'folder' }]"
          @click="file.type === 'folder' && !isTrashMode && $emit('enter-folder', file)"
        >{{ file.name }}</div>
        <div class="card-meta">
          <template v-if="isTrashMode">{{ file.originalPath || '根目录' }} · {{ file.time }}</template>
          <template v-else>{{ file.size }} · {{ file.time }}</template>
        </div>
        <div v-if="renamingId !== file.id" class="card-actions">
          <template v-if="isTrashMode">
            <button class="card-action-btn" @click="$emit('restore', file)">♻️</button>
            <button class="card-action-btn card-action-btn-danger" @click="$emit('permanent-delete', file)">🗑️</button>
          </template>
          <template v-else>
            <button class="card-action-btn" @click="$emit('preview', file)">👁️</button>
            <button class="card-action-btn" @click="$emit('download', file)">⬇️</button>
            <button class="card-action-btn" @click="$emit('share', file)">🔗</button>
            <button class="card-action-btn" @click="startRename(file)">✏️</button>
            <button class="card-action-btn" @click="$emit('move', file)">📋</button>
            <button class="card-action-btn" @click="$emit('delete', file)">🗑️</button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  files: any[];
  selectedIds: string[];
  viewMode: string;
  renamingId?: string | null;
  isTrashMode?: boolean;
}>();

const emit = defineEmits(['preview', 'download', 'share', 'move', 'delete', 'rename', 'select-change', 'enter-folder', 'confirm-create', 'cancel-create', 'confirm-rename', 'cancel-rename', 'restore', 'permanent-delete']);

const renameValue = ref('');

const startRename = (file: any) => {
  renameValue.value = file.name;
  emit('rename', file.id);
};

const onRenameKeyup = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    emit('confirm-rename', renameValue.value);
  } else if (e.key === 'Escape') {
    emit('cancel-rename');
  }
};

let blurTimer: ReturnType<typeof setTimeout> | null = null;

const onRenameBlur = () => {
  blurTimer = setTimeout(() => {
    emit('cancel-rename');
  }, 150);
};

const onRenameBtn = (action: 'confirm' | 'cancel') => {
  if (blurTimer) {
    clearTimeout(blurTimer);
    blurTimer = null;
  }
  if (action === 'confirm') {
    emit('confirm-rename', renameValue.value);
  } else {
    emit('cancel-rename');
  }
};

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
  table-layout: fixed;
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
  overflow: hidden;
}

.col-check {
  width: 40px;
  padding-left: 16px !important;
}

.col-name {
  overflow: hidden;
  width: 70%;
  display: flex;
  align-items: center;
}

.col-time {
  width: 15%;
  text-align: right;
}

.col-size {
  width: 15%;
  text-align: right;
}

.col-path {
  width: 15%;
  text-align: left;
  color: #999;
  font-size: 13px;
}

.col-actions-header {
  width: 0;
  padding: 0 !important;
}

.file-row {
  position: relative;
}

.file-row:hover {
  background: #F8FAFC;
}

.file-row:hover .action-bar {
  background: #F8FAFC;
  opacity: 1;
}

.renaming-row {
  background: #F0F7FF !important;
}

.folder-row {
  cursor: pointer;
}

/* 浮动操作栏 - 右侧遮盖 */
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

.file-icon {
  flex-shrink: 0;
  width: 24px;
  font-size: 18px;
  text-align: center;
  margin-right: 8px;
}

.file-name {
  font-size: 14px;
  color: #1F2329;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  max-width: 100%;
}

.folder-link {
  cursor: pointer;
  color: #4A90D9;
}

.folder-link:hover {
  text-decoration: underline;
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

.card-action-btn-danger:hover {
  background: #FDE2E2;
  color: #F5222D;
}

.card-rename-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.card-rename-input {
  width: 100%;
  border: 1px solid #4A90D9;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
  text-align: center;
  outline: none;
}

.card-rename-actions {
  display: flex;
  gap: 8px;
}
</style>