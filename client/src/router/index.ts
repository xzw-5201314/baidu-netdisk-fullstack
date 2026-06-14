import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '../stores/useUserStore';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../components/Login.vue')
    },
    {
      path: '/',
      name: 'drive',
      component: () => import('../views/DriveView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/trash',
      name: 'trash',
      component: () => import('../views/TrashView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/transfers',
      name: 'transfers',
      component: () => import('../views/TransferView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/shares',
      name: 'shares',
      component: () => import('../views/ShareView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/s/:code',
      name: 'share-access',
      component: () => import('../components/ShareAccess.vue')
    }
  ]
});

// 路由守卫
router.beforeEach(async (to) => {
  const userStore = useUserStore();

  // 分享访问页不需要登录
  if (to.name === 'share-access') return true;

  // 未登录时检查 token
  if (!userStore.isLoggedIn) {
    const ok = await userStore.checkLogin();
    if (!ok && to.name !== 'login') {
      return { name: 'login' };
    }
  }

  // 已登录访问登录页，跳转首页
  if (to.name === 'login' && userStore.isLoggedIn) {
    return { name: 'drive' };
  }

  return true;
});

export default router;
