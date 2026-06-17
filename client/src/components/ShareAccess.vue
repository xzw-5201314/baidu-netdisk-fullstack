<!-- src/components/ShareAccess.vue -->
<template>
  <div class="share-access-page">
    <div class="share-access-card">
      <!-- 加载中 -->
      <div v-if="loading" class="access-loading">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- 错误信息 -->
      <div v-else-if="error" class="access-error">
        <div class="error-icon">😢</div>
        <div class="error-title">{{ errorTitle }}</div>
        <div class="error-msg">{{ error }}</div>
        <button class="back-btn" @click="goHome">返回首页</button>
      </div>

      <!-- 正常内容 -->
      <template v-else-if="shareInfo">
        <!-- 头部 Logo -->
        <div class="access-header">
          <div class="access-logo">☁️ Easy云盘</div>
        </div>

        <!-- 文件信息 -->
        <div class="access-body">
          <div class="file-info-section">
            <div class="file-main-icon">{{ shareInfo.shareType === 'folder' ? '📁' : '📄' }}</div>
            <div class="file-main-name">{{ shareInfo.shareName }}</div>
            <div class="file-meta">
              <span v-if="shareInfo.fileSize">大小：{{ shareInfo.fileSize }}</span>
              <span v-if="shareInfo.fileCount !== null"> · {{ shareInfo.fileCount }} 个文件</span>
            </div>
          </div>

          <div class="share-detail">
            <div class="detail-item">
              <span class="detail-label">分享者</span>
              <span class="detail-value">{{ shareInfo.sharerName }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">分享时间</span>
              <span class="detail-value">{{ formatTime(shareInfo.createdAt) }}</span>
            </div>
            <div v-if="shareInfo.expireAt" class="detail-item">
              <span class="detail-label">过期时间</span>
              <span class="detail-value">{{ formatTime(shareInfo.expireAt) }}</span>
            </div>
          </div>

          <!-- 密码输入 -->
          <div v-if="needPassword && !passwordVerified" class="password-section">
            <div class="password-hint">🔒 请输入提取密码</div>
            <div class="password-form">
              <input
                v-model="inputPassword"
                type="text"
                class="password-field"
                placeholder="请输入密码"
                @keyup.enter="verifyPassword"
              />
              <button class="verify-btn" @click="verifyPassword" :disabled="verifying">
                {{ verifying ? '验证中...' : '提取文件' }}
              </button>
            </div>
            <div v-if="passwordError" class="password-error">{{ passwordError }}</div>
          </div>

          <!-- 下载按钮 -->
          <div v-if="!needPassword || passwordVerified" class="download-section">
            <button class="download-btn" @click="handleDownload">
              ⬇️ 下载文件
            </button>
          </div>
        </div>

        <!-- 底部 -->
        <div class="access-footer">
          <span>Easy云盘 · 文件分享</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { API_BASE } from '../config/api';

const loading = ref(true);
const error = ref('');
const errorTitle = ref('无法访问');
const shareInfo = ref<any>(null);
const needPassword = ref(false);
const passwordVerified = ref(false);
const inputPassword = ref('');
const passwordError = ref('');
const verifying = ref(false);

// 从 URL 获取 shareCode
const getShareCode = (): string => {
  const path = window.location.pathname;
  // /s/:code 格式
  const match = path.match(/\/s\/([^/?#]+)/);
  return match ? match[1] : '';
};

const code = getShareCode();

// 获取分享信息
const fetchShareInfo = async () => {
  if (!code) {
    error.value = '无效的分享链接';
    loading.value = false;
    return;
  }

  try {
    const res = await axios.get(`${API_BASE}/s/${code}`);
    if (res.data.code === 200) {
      shareInfo.value = res.data.data;
      needPassword.value = res.data.data.hasPassword;
    } else {
      error.value = res.data.msg || '获取分享信息失败';
    }
  } catch (err: any) {
    const status = err.response?.status;
    if (status === 404) {
      error.value = '该分享链接不存在';
    } else if (status === 410) {
      error.value = err.response?.data?.msg || '该分享已失效';
    } else {
      error.value = '网络错误，请稍后重试';
    }
  } finally {
    loading.value = false;
  }
};

// 验证密码
const verifyPassword = async () => {
  if (!inputPassword.value.trim()) {
    passwordError.value = '请输入密码';
    return;
  }

  verifying.value = true;
  passwordError.value = '';

  try {
    const res = await axios.post(`${API_BASE}/s/${code}/verify`, {
      password: inputPassword.value.trim()
    });

    if (res.data.code === 200) {
      passwordVerified.value = true;
    } else {
      passwordError.value = res.data.msg || '验证失败';
    }
  } catch (err: any) {
    passwordError.value = err.response?.data?.msg || '密码错误';
  } finally {
    verifying.value = false;
  }
};

// 下载文件
const handleDownload = async () => {
  try {
    const params: Record<string, string> = {};
    if (needPassword.value && passwordVerified.value) {
      params.password = inputPassword.value.trim();
    }

    const response = await axios.get(`${API_BASE}/s/${code}/download`, {
      responseType: 'blob',
      params
    });

    // 从 Content-Disposition 获取文件名
    const contentDisposition = response.headers['content-disposition'];
    let fileName = shareInfo.value?.shareName || 'download';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?([^;\n]*)/i);
      if (match) {
        fileName = decodeURIComponent(match[1].replace(/['"]/g, ''));
      }
    }

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    if (err.response?.data instanceof Blob) {
      // 尝试解析错误信息
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        ElMessage.error(json.msg || '下载失败');
      } catch {
        ElMessage.error('下载失败');
      }
    } else {
      ElMessage.error(err.response?.data?.msg || '下载失败');
    }
  }
};

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const goHome = () => {
  window.location.href = '/';
};

onMounted(() => {
  fetchShareInfo();
});
</script>

<style scoped>
.share-access-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.share-access-card {
  background: white;
  border-radius: 16px;
  width: 480px;
  max-width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.access-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 16px;
  color: #999;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #E5E6EB;
  border-top-color: #4A90D9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.access-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.error-msg {
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
}

.back-btn {
  padding: 8px 24px;
  background: #4A90D9;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.back-btn:hover {
  background: #357ABD;
}

.access-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.access-logo {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.access-body {
  padding: 24px;
}

.file-info-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  background: #F5F7FA;
  border-radius: 12px;
  margin-bottom: 20px;
}

.file-main-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.file-main-name {
  font-size: 16px;
  font-weight: 600;
  color: #1F2329;
  text-align: center;
  word-break: break-all;
  margin-bottom: 6px;
}

.file-meta {
  font-size: 13px;
  color: #999;
}

.share-detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;
  padding: 0 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.detail-label {
  color: #999;
}

.detail-value {
  color: #333;
}

.password-section {
  margin-bottom: 20px;
}

.password-hint {
  font-size: 14px;
  color: #333;
  margin-bottom: 12px;
  text-align: center;
}

.password-form {
  display: flex;
  gap: 8px;
}

.password-field {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #E5E6EB;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.password-field:focus {
  border-color: #4A90D9;
}

.verify-btn {
  padding: 10px 20px;
  background: #4A90D9;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}

.verify-btn:hover {
  background: #357ABD;
}

.verify-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.password-error {
  margin-top: 8px;
  font-size: 13px;
  color: #F5222D;
  text-align: center;
}

.download-section {
  text-align: center;
}

.download-btn {
  width: 100%;
  padding: 14px 24px;
  background: linear-gradient(135deg, #4A90D9, #357ABD);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.download-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 144, 217, 0.4);
}

.access-footer {
  padding: 16px 24px;
  text-align: center;
  font-size: 12px;
  color: #ccc;
  border-top: 1px solid #f0f0f0;
}
</style>
