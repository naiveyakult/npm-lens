import { ref } from 'vue'
import defaultGraph from '../assets/data/targetFilePath.json'

const graphData = ref(defaultGraph)

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

function filterTree(tree, keyword) {
  const normalized = keyword.trim().toLowerCase()

  if (!normalized) {
    return clone(tree)
  }

  function filterNode(node) {
    const result = {}

    for (const [key, value] of Object.entries(node || {})) {
      if (key.startsWith('$')) {
        result[key] = value
        continue
      }

      const child = filterNode(value)
      const matches = key.toLowerCase().includes(normalized)

      if (matches || Object.keys(child).some((childKey) => !childKey.startsWith('$'))) {
        result[key] = Object.keys(child).length > 0 ? child : value
      }
    }

    return result
  }

  return filterNode(tree)
}

export function getChartData(keyword = '') {
  return filterTree(graphData.value, keyword)
}

export function setChartData(nextGraph) {
  graphData.value = clone(nextGraph)
}

export function getCurrentGraph() {
  return clone(graphData.value)
}
