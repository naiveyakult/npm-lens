<template>
  <main class="home">
    <section class="home-main">
      <p class="eyebrow">npm-lens</p>
      <h1>NPM 依赖分析 CLI</h1>
      <p class="lead">
        从 package.json 出发递归读取 node_modules，生成依赖关系图、基础风险摘要和可选 AI 报告。
      </p>

      <div class="search-row">
        <el-input
          v-model.trim="targetPath"
          size="large"
          placeholder="目标项目路径，例如 /Users/you/project"
          clearable
        />
        <el-input
          v-model.trim="keyword"
          size="large"
          placeholder="输入包名筛选，例如 vue / vite / openai"
          clearable
          @keyup.enter="goAnalyze"
        />
        <el-input-number v-model="depth" :min="1" :max="5" size="large" />
        <el-button type="primary" size="large" @click="goAnalyze">开始分析</el-button>
      </div>
    </section>

    <section class="feature-strip">
      <div>
        <strong>依赖图</strong>
        <span>使用 ECharts + D3 绘制层级依赖</span>
      </div>
      <div>
        <strong>Agent API</strong>
        <span>Node 服务负责读取依赖和保护 API Key</span>
      </div>
      <div>
        <strong>AI 报告</strong>
        <span>OpenAI 可用时生成真实建议，否则本地规则兜底</span>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const targetPath = ref('')
const keyword = ref('')
const depth = ref(2)

function goAnalyze() {
  router.push({
    path: '/analysis',
    query: {
      keyword: keyword.value,
      depth: depth.value,
      targetPath: targetPath.value
    }
  })
}
</script>
