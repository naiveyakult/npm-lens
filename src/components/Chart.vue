<template>
  <div class="dependency-map">
    <div class="map-header">
      <div>
        <p class="map-kicker">Dependency Map</p>
        <h2>{{ activeMode === 'echarts' ? '依赖图谱' : '依赖层级图' }}</h2>
      </div>

      <div class="map-actions">
        <span>{{ visibleNodes.length }} nodes</span>
        <div class="view-toggle" role="group" aria-label="切换依赖图视图">
          <button
            type="button"
            :class="{ active: activeMode === 'echarts' }"
            :disabled="echartsFailed || visibleNodes.length === 0"
            @click="switchMode('echarts')"
          >
            图谱视图
          </button>
          <button
            type="button"
            :class="{ active: activeMode === 'list' }"
            @click="switchMode('list')"
          >
            层级列表
          </button>
        </div>
      </div>
    </div>

    <p v-if="visibleNodes.length === 0" class="empty-message">
      没有匹配的依赖包
    </p>

    <p v-else-if="echartsFailed" class="chart-message">
      图谱视图渲染失败，已切换到层级列表。{{ chartError }}
    </p>

    <div v-show="visibleNodes.length > 0 && activeMode === 'echarts'" ref="chartRef" class="graph-canvas" />

    <div v-if="visibleNodes.length > 0 && activeMode === 'list'" class="columns">
      <section v-for="column in columns" :key="column.depth" class="depth-column">
        <header>
          <strong>Depth {{ column.depth }}</strong>
          <span>{{ column.nodes.length }}</span>
        </header>

        <article v-for="node in column.nodes" :key="node.id" class="dep-node">
          <div class="node-main">
            <strong>{{ node.name }}</strong>
            <small v-if="node.parent">from {{ node.parent }}</small>
          </div>
          <div class="node-meta">
            <span v-if="node.version">{{ node.version }}</span>
            <span v-if="node.license">{{ node.license }}</span>
            <span v-if="node.installed === false" class="warn">missing</span>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  graph: {
    type: Object,
    required: true
  },
  keyword: {
    type: String,
    default: ''
  }
})

const chartRef = ref(null)
const viewMode = ref('echarts')
const echartsFailed = ref(false)
const chartError = ref('')
let chart = null

const visibleNodes = computed(() => flattenGraph(props.graph, props.keyword))
const columns = computed(() => {
  const byDepth = new Map()

  for (const node of visibleNodes.value) {
    if (!byDepth.has(node.depth)) {
      byDepth.set(node.depth, [])
    }
    byDepth.get(node.depth).push(node)
  }

  return Array.from(byDepth.entries())
    .sort(([a], [b]) => a - b)
    .map(([depth, nodes]) => ({
      depth,
      nodes: nodes
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 120)
    }))
})
const graphOptionData = computed(() => toGraphOptionData(visibleNodes.value))
const activeMode = computed(() => (echartsFailed.value ? 'list' : viewMode.value))

onMounted(async () => {
  await nextTick()
  initChart()
  window.addEventListener('resize', resizeChart)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart)
  chart?.dispose()
})

watch(
  () => [props.graph, props.keyword],
  async () => {
    echartsFailed.value = false
    chartError.value = ''
    await nextTick()
    renderChart()
  },
  { deep: true }
)

watch(activeMode, async (mode) => {
  if (mode === 'echarts') {
    await nextTick()
    initChart()
    renderChart()
  }
})

function switchMode(mode) {
  viewMode.value = mode
}

function initChart() {
  if (!chartRef.value || chart) {
    return
  }

  try {
    chart = echarts.init(chartRef.value)
    renderChart()
  } catch (error) {
    failChart(error)
  }
}

function resizeChart() {
  chart?.resize()
}

function renderChart() {
  if (activeMode.value !== 'echarts' || visibleNodes.value.length === 0) {
    return
  }

  initChart()

  if (!chart) {
    return
  }

  try {
    const { nodes, links, categories } = graphOptionData.value
    chart.setOption({
      animationDuration: 700,
      animationEasingUpdate: 'quinticInOut',
      tooltip: {
        trigger: 'item',
        formatter(params) {
          if (params.dataType === 'edge') {
            return `${params.data.sourceName}<br>依赖于<br>${params.data.targetName}`
          }

          const item = params.data.raw
          return [
            `<strong>${item.name}</strong>`,
            item.parent ? `from: ${item.parent}` : 'direct dependency',
            item.version ? `版本: ${item.version}` : '',
            item.license ? `许可证: ${item.license}` : '',
            item.installed === false ? 'node_modules 元数据缺失' : ''
          ].filter(Boolean).join('<br>')
        }
      },
      legend: [
        {
          top: 4,
          left: 4,
          itemWidth: 10,
          itemHeight: 10,
          textStyle: {
            color: '#60718c',
            fontSize: 12
          },
          data: categories.map((item) => item.name)
        }
      ],
      series: [
        {
          name: 'Dependencies',
          type: 'graph',
          layout: 'force',
          data: nodes,
          links,
          categories,
          roam: true,
          draggable: true,
          focusNodeAdjacency: true,
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: [0, 7],
          label: {
            show: true,
            position: 'right',
            formatter: '{b}',
            color: '#172033',
            fontSize: 11,
            overflow: 'truncate',
            width: 100
          },
          lineStyle: {
            color: 'source',
            opacity: 0.34,
            width: 1.2,
            curveness: 0.12
          },
          force: {
            repulsion: 95,
            gravity: 0.06,
            edgeLength: [42, 115],
            friction: 0.62,
            layoutAnimation: true
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              opacity: 0.85,
              width: 2
            }
          }
        }
      ]
    }, true)
    chart.resize()
  } catch (error) {
    failChart(error)
  }
}

function failChart(error) {
  chartError.value = error instanceof Error ? error.message : '未知错误'
  echartsFailed.value = true
  viewMode.value = 'list'
  chart?.dispose()
  chart = null
}

function flattenGraph(graph, keyword) {
  const nodes = []
  const normalized = keyword.trim().toLowerCase()

  function visit(source, depth, parent, path) {
    for (const [name, value] of Object.entries(source || {})) {
      if (name.startsWith('$')) {
        continue
      }

      const id = [...path, name].join(' > ')
      const nextNode = {
        id,
        name,
        parent,
        parentId: path.join(' > '),
        depth,
        version: value?.$version || value?.$versionRange || '',
        license: value?.$license || '',
        installed: value?.$installed
      }

      if (!normalized || id.toLowerCase().includes(normalized)) {
        nodes.push(nextNode)
      }

      visit(value, depth + 1, name, [...path, name])
    }
  }

  visit(graph, 1, '', [])
  return nodes
}

function toGraphOptionData(flatNodes) {
  const nodeIds = new Set(flatNodes.map((node) => node.id))
  const categories = [
    { name: '直接依赖' },
    { name: '传递依赖' },
    { name: '缺少元数据' }
  ]

  const nodes = flatNodes.map((node) => {
    const category = node.installed === false ? 2 : node.depth === 1 ? 0 : 1
    const symbolSize = node.depth === 1 ? 28 : Math.max(10, 24 - node.depth * 2)

    return {
      id: node.id,
      name: node.name,
      value: node.depth,
      category,
      symbolSize,
      raw: node,
      itemStyle: {
        color: node.installed === false
          ? '#f2c94c'
          : node.depth === 1
            ? '#2f80ed'
            : '#56cc9d'
      }
    }
  })

  const links = flatNodes
    .filter((node) => node.parentId && nodeIds.has(node.parentId))
    .map((node) => ({
      source: node.parentId,
      target: node.id,
      sourceName: node.parent,
      targetName: node.name
    }))

  return { nodes, links, categories }
}
</script>

<style scoped>
.dependency-map {
  height: 100%;
  min-height: 680px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
}

.map-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}

.map-kicker {
  margin: 0;
  color: #2f80ed;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.map-header h2 {
  margin: 4px 0 0;
  color: #14213d;
  font-size: 22px;
}

.map-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.map-actions > span {
  color: #66748a;
  font-size: 13px;
}

.view-toggle {
  display: inline-flex;
  padding: 3px;
  border: 1px solid #d8e3f5;
  border-radius: 8px;
  background: #f8fbff;
}

.view-toggle button {
  min-width: 74px;
  padding: 5px 10px;
  border: 0;
  border-radius: 6px;
  color: #60718c;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
}

.view-toggle button.active {
  color: #ffffff;
  background: #2f80ed;
}

.view-toggle button:disabled {
  color: #aab5c5;
  cursor: not-allowed;
}

.graph-canvas {
  flex: 1;
  min-height: 600px;
  width: 100%;
  border: 1px solid #dfe6f2;
  border-radius: 8px;
  background:
    radial-gradient(circle at 24px 24px, rgba(47, 128, 237, 0.06) 2px, transparent 2px),
    #ffffff;
  background-size: 28px 28px;
}

.chart-message {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #ffd6d6;
  border-radius: 8px;
  color: #9f2d2d;
  background: #fff5f5;
}

.columns {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 280px);
  gap: 14px;
  overflow: auto;
  padding-bottom: 6px;
}

.depth-column {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #dfe6f2;
  border-radius: 8px;
  background: #f8fbff;
}

.depth-column header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #60718c;
  font-size: 13px;
}

.dep-node {
  position: relative;
  padding: 10px;
  border: 1px solid #d8e3f5;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(20, 33, 61, 0.06);
}

.dep-node::before {
  content: "";
  position: absolute;
  left: -13px;
  top: 22px;
  width: 12px;
  height: 1px;
  background: #9fb4d6;
}

.depth-column:first-child .dep-node::before {
  display: none;
}

.node-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.node-main strong {
  color: #172033;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.node-main small {
  color: #7a8799;
  overflow-wrap: anywhere;
}

.node-meta {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.node-meta span {
  padding: 2px 6px;
  border-radius: 999px;
  background: #edf4ff;
  color: #35547a;
  font-size: 11px;
}

.node-meta .warn {
  background: #fff5d6;
  color: #8a6500;
}

.empty-message {
  margin: 0;
  padding: 18px;
  color: #66748a;
}

@media (max-width: 960px) {
  .map-header,
  .map-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .graph-canvas {
    min-height: 520px;
  }
}
</style>
