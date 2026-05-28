<template>
  <main class="analysis-page">
    <header class="toolbar">
      <el-button @click="router.push('/')">返回</el-button>
      <el-input v-model.trim="targetPath" placeholder="目标项目路径" clearable />
      <el-input v-model.trim="keyword" placeholder="筛选依赖包" clearable />
      <el-input-number v-model="depth" :min="1" :max="5" />
      <el-button type="primary" :loading="loading" @click="runAnalysis">
        {{ loading ? '分析中' : '重新分析' }}
      </el-button>
    </header>

    <section class="stats-grid">
      <div>
        <span>目标项目</span>
        <strong class="path-stat">{{ displayTargetPath }}</strong>
      </div>
      <div>
        <span>依赖总数</span>
        <strong>{{ summary.packageCount }}</strong>
      </div>
      <div>
        <span>直接依赖</span>
        <strong>{{ summary.directDependencies }}</strong>
      </div>
      <div>
        <span>最大深度</span>
        <strong>{{ summary.maxDepth }}</strong>
      </div>
      <div>
        <span>主要许可证</span>
        <strong>{{ topLicense }}</strong>
      </div>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="workspace">
      <div class="chart-shell">
        <Chart :graph="filteredGraph" :keyword="keyword" />
      </div>
      <AiReportPanel :report="report" />
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Chart from '../components/Chart.vue'
import AiReportPanel from '../components/AiReportPanel.vue'
import { analyzeDependencies, getReportData } from '../services/aiReport.js'
import { getChartData, getCurrentGraph, setChartData } from '../utils/getChartData.js'
import { summarizeGraph } from '../utils/graphSummary.js'

const route = useRoute()
const router = useRouter()
const keyword = ref(String(route.query.keyword || ''))
const targetPath = ref(String(route.query.targetPath || ''))
const depth = ref(Number(route.query.depth || 2))
const graph = ref(getCurrentGraph())
const report = ref(null)
const loading = ref(false)
const error = ref('')

const filteredGraph = computed(() => getChartData(keyword.value, depth.value))
const summary = computed(() => summarizeGraph(filteredGraph.value))
const topLicense = computed(() => summary.value.topLicenses[0]?.license || 'unknown')
const displayTargetPath = computed(() => targetPath.value || summary.value.project?.root || '当前项目')

onMounted(() => {
  runAnalysis()
})

async function runAnalysis() {
  loading.value = true
  error.value = ''

  try {
    const result = await loadAnalysisResult()
    graph.value = result.graph
    setChartData(result.graph)
    report.value = result.report
    targetPath.value = result.targetPath || targetPath.value || result.summary?.project?.root || ''
  } catch (analysisError) {
    error.value = analysisError.message
    report.value = {
      mode: 'local-rule',
      summary: '当前展示内置样例依赖图。',
      risks: ['未能读取 CLI report 数据或开发 API 数据。'],
      recommendations: ['正式模式请通过 npm-lens analyze 打开报告页；开发模式请使用 npm run dev:all。'],
      nextActions: ['确认 dist 已构建，或启动开发 API 后重试。']
    }
  } finally {
    loading.value = false
  }
}

async function loadAnalysisResult() {
  try {
    const result = await getReportData()
    return {
      ...result,
      report: {
        mode: 'local-rule',
        summary: `已加载 ${result.targetPath || '目标项目'} 的 CLI 分析结果。`,
        risks: buildFallbackRisks(result.summary),
        recommendations: ['使用 --json 可保存原始依赖图；使用 --ai 可生成 AI/规则报告。'],
        nextActions: ['检查同包多版本、循环依赖和未安装依赖提示。']
      }
    }
  } catch {
    return analyzeDependencies({ depth: depth.value, targetPath: targetPath.value })
  }
}

function buildFallbackRisks(nextSummary) {
  const risks = []

  if (nextSummary?.circularCount > 0) {
    risks.push(`发现 ${nextSummary.circularCount} 处循环依赖标记。`)
  } else {
    risks.push('当前样本中没有发现循环依赖标记。')
  }

  if (nextSummary?.multiVersionPackages?.length > 0) {
    risks.push(`发现 ${nextSummary.multiVersionPackages.length} 个包存在多版本实例。`)
  } else {
    risks.push('当前样本中没有发现同包多版本实例。')
  }

  if (nextSummary?.duplicatePackages?.length > 0) {
    const examples = nextSummary.duplicatePackages
      .slice(0, 5)
      .map((item) => `${item.name}(${item.count}次)`)
      .join('、')
    risks.push(`发现 ${nextSummary.duplicatePackages.length} 个包重复出现在多条依赖路径中，例如 ${examples}。这不等同于循环依赖。`)
  } else {
    risks.push('当前样本中没有发现同名包重复出现在多条依赖路径中。')
  }

  if (nextSummary?.missingCount > 0) {
    risks.push(`有 ${nextSummary.missingCount} 个依赖缺少 node_modules 元数据，分析可能不完整。`)
  }

  return risks
}
</script>
