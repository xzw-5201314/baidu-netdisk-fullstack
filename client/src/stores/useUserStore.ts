import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';
import { API_BASE } from '../config/api';

export const useUserStore = defineStore('user', () => {
  const isLoggedIn = ref(false);
  const username = ref('');

  // 验证 token 是否有效
  const checkLogin = async (): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
      const res = await axios.get(`${API_BASE}/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.code === 200) {
        isLoggedIn.value = true;
        username.value = res.data.data.username;
        return true;
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
    }
    return false;
  };

  // 登录成功后设置状态
  const setLoggedIn = () => {
    username.value = localStorage.getItem('username') || '';
    isLoggedIn.value = true;
  };

  // 退出登录
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    isLoggedIn.value = false;
    username.value = '';
  };

  return { isLoggedIn, username, checkLogin, setLoggedIn, logout };
});
