import { ref } from 'vue'
import defaultGraph from '../assets/data/targetFilePath.json'

const graphData = ref(defaultGraph)

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

function filterTree(tree, keyword, maxDepth = Infinity) {
  const normalized = keyword.trim().toLowerCase()
  const depthLimit = Number.isFinite(Number(maxDepth)) ? Number(maxDepth) : Infinity

  if (!normalized && depthLimit === Infinity) {
    return clone(tree)
  }

  function filterNode(node, depth) {
    const result = {}

    for (const [key, value] of Object.entries(node || {})) {
      if (key.startsWith('$')) {
        result[key] = value
        continue
      }

      if (depth > depthLimit) {
        continue
      }

      const child = filterNode(value, depth + 1)
      const matches = key.toLowerCase().includes(normalized)
      const hasMatchedChild = Object.keys(child).some((childKey) => !childKey.startsWith('$'))

      if (!normalized || matches || hasMatchedChild) {
        result[key] = Object.keys(child).length > 0 ? child : value
      }
    }

    return result
  }

  return filterNode(tree, 1)
}

export function getChartData(keyword = '', maxDepth = Infinity) {
  return filterTree(graphData.value, keyword, maxDepth)
}

export function setChartData(nextGraph) {
  graphData.value = clone(nextGraph)
}

export function getCurrentGraph() {
  return clone(graphData.value)
}
