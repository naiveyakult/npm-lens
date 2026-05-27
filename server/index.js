import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAiReport } from './aiReport.js'
import { generateDependencyGraph, saveGraph, summarizeGraph, resolveProjectRoot } from './dependencyGraph.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const defaultPort = Number(process.env.PORT || 8787)

export function createApp(options = {}) {
  const app = express()
  const generatedAt = options.generatedAt || new Date().toISOString()
  const reportData = options.graph && options.summary
    ? {
        graph: options.graph,
        summary: options.summary,
        targetPath: options.targetPath || options.summary.project?.root || '',
        generatedAt
      }
    : null

  app.use(cors())
  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      ai: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      reportReady: Boolean(reportData)
    })
  })

  app.get('/api/report-data', (req, res) => {
    if (!reportData) {
      res.status(404).json({
        error: 'Report data is not available',
        message: 'Run npm-lens analyze to create a report session.'
      })
      return
    }

    res.json(reportData)
  })

  app.post('/api/analyze', async (req, res) => {
    try {
      const depth = Number(req.body?.depth || 2)
      const targetPath = resolveProjectRoot(req.body?.targetPath || projectRoot)
      const graph = await generateDependencyGraph({ root: targetPath, depth })
      const summary = summarizeGraph(graph)
      const report = await createAiReport(summary)

      saveGraph(graph, path.join(projectRoot, 'src/assets/data/targetFilePath.json'))

      res.json({ graph, summary, report, targetPath })
    } catch (error) {
      res.status(500).json({
        error: '分析失败',
        message: error instanceof Error ? error.message : String(error)
      })
    }
  })

  const distDir = path.join(projectRoot, 'dist')

  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir))
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  } else if (reportData) {
    app.use((req, res) => {
      res.status(500).send('Frontend build not found. Please run `npm run build` before using report mode.')
    })
  }

  return app
}

export function startReportServer(options = {}) {
  if (!fs.existsSync(path.join(projectRoot, 'dist'))) {
    throw new Error('Frontend build not found. Please run `npm run build` before using report mode.')
  }

  const app = createApp(options)

  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1')

    server.once('error', reject)
    server.once('listening', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        server,
        port,
        url: `http://127.0.0.1:${port}`
      })
    })
  })
}

const isDirectRun = process.argv[1] === __filename

if (isDirectRun) {
  const app = createApp()
  app.listen(defaultPort, () => {
    console.log(`npm-lens API running at http://localhost:${defaultPort}`)
  })
}
