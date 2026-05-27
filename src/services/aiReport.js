export async function analyzeDependencies({ depth = 2, targetPath = '' } = {}) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ depth, targetPath })
  })

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'AI analysis failed')
  }

  return payload
}

export async function getReportData() {
  const response = await fetch('/api/report-data')
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Report data is unavailable')
  }

  return payload
}

export async function getApiHealth() {
  const response = await fetch('/api/health')
  if (!response.ok) {
    throw new Error('API service is unavailable')
  }
  return response.json()
}
