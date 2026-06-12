<!-- src/components/ShareDialog.vue -->
<template>
  <div v-if="visible" class="share-overlay" @click.self="$emit('close')">
    <div class="share-dialog">
      <div class="share-header">
        <h3>🔗 分享文件</h3>
        <button class="share-close" @click="$emit('close')">✕</button>
      </div>

      <div class="share-body">
        <!-- 文件信息 -->
        <div class="share-file-info">
          <span class="share-file-icon">{{ shareType === 'folder' ? '📁' : '📄' }}</span>
          <span class="share-file-name">{{ shareName }}</span>
        </div>

        <!-- 未生成链接时显示设置项 -->
        <template v-if="!shareResult">
          <!-- 密码设置 -->
          <div class="share-option">
            <label class="option-label">
              <input type="checkbox" v-model="usePassword" class="option-checkbox" />
              <span>设置提取密码</span>
            </label>
            <input
              v-if="usePassword"
              v-model="password"
              type="text"
              class="password-input"
              placeholder="请输入4-8位密码"
              maxlength="8"
            />
          </div>

          <!-- 过期时间 -->
          <div class="share-option">
            <label class="option-label">有效期</label>
            <div class="expire-options">
              <button
                v-for="opt in expireOptions"
                :key="opt.value"
                :class="['expire-btn', { active: expireDays === opt.value }]"
                @click="expireDays = opt.value"
              >{{ opt.label }}</button>
            </div>
          </div>
        </template>

        <!-- 已生成链接 -->
        <template v-else>
          <div class="share-result">
            <div class="result-label">分享链接</div>
            <div class="result-link-box">
              <input
                ref="linkInput"
                :value="shareLink"
                readonly
                class="result-link-input"
              />
              <button class="copy-btn" @click="copyLink">{{ copied ? '已复制 ✓' : '复制链接' }}</button>
            </div>

            <div v-if="shareResult.hasPassword" class="result-info">
              <span class="result-info-label">提取密码</span>
              <span class="result-info-value">{{ password }}</span>
            </div>

            <div v-if="shareResult.expireAt" class="result-info">
              <span class="result-info-label">过期时间</span>
              <span class="result-info-value">{{ formatExpireTime(shareResult.expireAt) }}</span>
            </div>
          </div>
        </template>
      </div>

      <div class="share-footer">
        <template v-if="!shareResult">
          <button class="share-btn-cancel" @click="$emit('close')">取消</button>
          <button class="share-btn-confirm" @click="handleCreateShare" :disabled="creating">
            {{ creating ? '生成中...' : '创建分享' }}
          </button>
        </template>
        <template v-else>
          <button class="share-btn-cancel" @click="resetForm">再创建一个</button>
          <button class="share-btn-confirm" @click="$emit('close')">完成</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { API_BASE } from '../config/api';

const props = defineProps<{
  visible: boolean;
  targetId: string;
  shareType: 'file' | 'folder';
  shareName: string;
}>();

defineEmits(['close']);

const usePassword = ref(false);
const password = ref('');
const expireDays = ref(0);
const creating = ref(false);
const shareResult = ref<any>(null);
const copied = ref(false);
const linkInput = ref<HTMLInputElement | null>(null);

// 每次打开对话框时重置状态
watch(() => props.visible, (val) => {
  if (val) {
    shareResult.value = null;
    usePassword.value = false;
    password.value = '';
    expireDays.value = 0;
    copied.value = false;
  }
});

const expireOptions = [
  { label: '永久', value: 0 },
  { label: '1天', value: 1 },
  { label: '7天', value: 7 },
  { label: '30天', value: 30 },
];

// 重置表单，允许为同一文件再创建一个分享
const resetForm = () => {
  shareResult.value = null;
  usePassword.value = false;
  password.value = '';
  expireDays.value = 0;
  copied.value = false;
};

const shareLink = computed(() => {
  if (!shareResult.value) return '';
  // 使用当前页面的 origin + /s/ + code
  return `${window.location.origin}/s/${shareResult.value.shareCode}`;
});

const handleCreateShare = async () => {
  if (usePassword.value && (!password.value || password.value.trim().length < 1)) {
    ElMessage.warning('请输入提取密码');
    return;
  }

  creating.value = true;
  try {
    const res = await axios.post(`${API_BASE}/api/share`, {
      targetId: props.targetId,
      shareType: props.shareType,
      password: usePassword.value ? password.value.trim() : null,
      expireDays: expireDays.value || null
    });

    if (res.data.code === 200) {
      shareResult.value = res.data.data;
      ElMessage.success('分享创建成功');
    } else {
      ElMessage.error(res.data.msg || '创建失败');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.msg || '创建分享失败');
  } finally {
    creating.value = false;
  }
};

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(shareLink.value);
    copied.value = true;
    ElMessage.success('链接已复制到剪贴板');
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    // fallback: 选中并复制
    linkInput.value?.select();
    document.execCommand('copy');
    copied.value = true;
    ElMessage.success('链接已复制到剪贴板');
    setTimeout(() => { copied.value = false; }, 2000);
  }
};

const formatExpireTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};
</script>

<style scoped>
.share-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.share-dialog {
  background: white;
  border-radius: 12px;
  width: 460px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: shareSlideIn 0.2s ease-out;
}

@keyframes shareSlideIn {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.share-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e8e8e8;
}

.share-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.share-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #999;
  padding: 4px;
}

.share-close:hover {
  color: #333;
}

.share-body {
  padding: 20px;
}

.share-file-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #F5F7FA;
  border-radius: 8px;
  margin-bottom: 20px;
}

.share-file-icon {
  font-size: 24px;
}

.share-file-name {
  font-size: 14px;
  color: #1F2329;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-option {
  margin-bottom: 20px;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  margin-bottom: 10px;
}

.option-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #4A90D9;
}

.password-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #E5E6EB;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.password-input:focus {
  border-color: #4A90D9;
}

.expire-options {
  display: flex;
  gap: 8px;
}

.expire-btn {
  flex: 1;
  padding: 8px 0;
  border: 1px solid #E5E6EB;
  border-radius: 6px;
  background: white;
  font-size: 13px;
  color: #646A73;
  cursor: pointer;
  transition: all 0.2s;
}

.expire-btn:hover {
  border-color: #4A90D9;
  color: #4A90D9;
}

.expire-btn.active {
  background: #E8F0FE;
  border-color: #4A90D9;
  color: #4A90D9;
  font-weight: 500;
}

.share-result {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.result-label {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.result-link-box {
  display: flex;
  gap: 8px;
}

.result-link-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #E5E6EB;
  border-radius: 6px;
  font-size: 13px;
  color: #333;
  background: #F5F7FA;
  outline: none;
}

.copy-btn {
  padding: 8px 16px;
  background: #4A90D9;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}

.copy-btn:hover {
  background: #357ABD;
}

.result-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.result-info-label {
  color: #999;
}

.result-info-value {
  color: #333;
  font-weight: 500;
}

.share-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #e8e8e8;
}

.share-btn-cancel {
  padding: 8px 20px;
  background: #F5F7FA;
  border: 1px solid #E5E6EB;
  border-radius: 6px;
  font-size: 14px;
  color: #646A73;
  cursor: pointer;
}

.share-btn-cancel:hover {
  background: #E5E6EB;
}

.share-btn-confirm {
  padding: 8px 20px;
  background: #4A90D9;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.share-btn-confirm:hover {
  background: #357ABD;
}

.share-btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
