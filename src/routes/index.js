import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'MainView',
    component: () => import('../views/MainView.vue')
  },
  {
    path: '/analysis',
    name: 'DataDisplay',
    component: () => import('../views/DataDisplay.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export const setupRouter = async (app) => {
  app.use(router)
  await router.isReady()
}

export default router
