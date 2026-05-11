<template>
  <div class="login-container">
    <div class="login-box">
      <h2 class="login-title">🔐 {{ isLogin ? '登录' : '注册' }}</h2>
      
      <div class="form-group">
        <label>用户名</label>
        <input 
          v-model="form.username" 
          type="text" 
          placeholder="请输入用户名"
          class="form-input"
        />
      </div>
      
      <div class="form-group">
        <label>密码</label>
        <input 
          v-model="form.password" 
          type="password" 
          placeholder="请输入密码"
          class="form-input"
        />
      </div>
      
      <button 
        @click="handleSubmit" 
        :disabled="loading"
        class="submit-btn"
      >
        {{ loading ? '处理中...' : (isLogin ? '登录' : '注册') }}
      </button>
      
      <p class="toggle-text">
        {{ isLogin ? '还没有账号？' : '已有账号？' }}
        <span @click="isLogin = !isLogin" class="toggle-link">
          {{ isLogin ? '立即注册' : '立即登录' }}
        </span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import axios from 'axios';

const emit = defineEmits(['login-success']);

const isLogin = ref(true);
const loading = ref(false);
const form = reactive({
  username: '',
  password: ''
});

const handleSubmit = async () => {
  if (!form.username || !form.password) {
    alert('请填写完整信息');
    return;
  }

  loading.value = true;

  try {
    const url = isLogin.value ? '/login' : '/register';
    const res = await axios.post(`http://localhost:3000${url}`, form);

    if (res.data.code === 200) {
      if (isLogin.value) {
        // 登录成功，保存Token
        localStorage.setItem('token', res.data.data.token);
        localStorage.setItem('username', res.data.data.username);
        emit('login-success');
      } else {
        alert('注册成功，请登录');
        isLogin.value = true;
      }
    } else {
      alert(res.data.msg);
    }
  } catch (error: any) {
    // 更详细的错误处理
    if (error.response) {
      const msg = error.response.data?.msg || '请求失败';
      alert(msg);
    } else if (error.request) {
      alert('网络连接失败，请检查后端服务');
    } else {
      alert('请求错误: ' + error.message);
    }
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-box {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 400px;
}

.login-title {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #666;
}

.form-input {
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
}

.submit-btn {
  width: 100%;
  padding: 0.8rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 1rem;
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.toggle-text {
  text-align: center;
  margin-top: 1rem;
  color: #999;
}

.toggle-link {
  color: #667eea;
  cursor: pointer;
}
</style>