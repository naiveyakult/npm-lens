import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import { setupRouter } from './routes/index.js'
import './style.css'

const app = createApp(App)

app.use(ElementPlus)
setupRouter(app).then(() => {
  app.mount('#app')
})
