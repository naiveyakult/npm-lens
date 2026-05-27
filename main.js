#!/usr/bin/env node
import path from 'node:path'
import { spawn } from 'node:child_process'
import { generateDependencyGraph, saveGraph, summarizeGraph, resolveProjectRoot } from './server/dependencyGraph.js'
import { startReportServer } from './server/index.js'

const VERSION = '0.1.0'

async function main() {
  const [command, ...args] = process.argv.slice(2)

  if (!command || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command === '--version' || command === '-v') {
    console.log(VERSION)
    return
  }

  if (command !== 'analyze') {
    console.error(`Unknown command: ${command}`)
    printHelp()
    process.exitCode = 1
    return
  }

  await analyze(parseArgs(args))
}

async function analyze(options) {
  const target = resolveProjectRoot(options.target || process.cwd())
  const depth = Number(options.depth || 2)
  let graph

  try {
    graph = await generateDependencyGraph({ root: target, depth })
  } catch (error) {
    if (error instanceof Error && error.message.includes('package.json')) {
      throw new Error('Target project must contain package.json')
    }

    throw error
  }

  const summary = summarizeGraph(graph)

  if (options.json) {
    const outputPath = path.resolve(options.json)
    saveGraph({ graph, summary }, outputPath)
    console.log(`Dependency analysis saved to ${outputPath}`)
    return
  }

  if (options.ai) {
    const { createAiReport } = await import('./server/aiReport.js')
    const report = await createAiReport(summary)
    console.log(JSON.stringify({ summary, report }, null, 2))
    return
  }

  if (summary.missingCount > 0) {
    console.warn('Warning: node_modules appears incomplete. Dependency details may be incomplete.')
  }

  const { url } = await startReportServer({ graph, summary, targetPath: target })
  console.log(`Report opened at: ${url}`)
  console.log('Press Ctrl+C to stop the report server.')
  openUrl(url)
}

function openUrl(url) {
  let command
  let args

  if (process.platform === 'darwin') {
    command = 'open'
    args = [url]
  } else if (process.platform === 'win32') {
    command = 'cmd'
    args = ['/c', 'start', '', url]
  } else {
    command = 'xdg-open'
    args = [url]
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore'
  })

  child.unref()
}

function parseArgs(args) {
  const options = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--ai') {
      options.ai = true
      continue
    }

    if (arg.startsWith('--depth=')) {
      options.depth = arg.slice('--depth='.length)
      continue
    }

    if (arg === '--depth' || arg === '-d') {
      options.depth = args[index + 1]
      index += 1
      continue
    }

    if (arg.startsWith('--target=')) {
      options.target = arg.slice('--target='.length)
      continue
    }

    if (arg === '--target' || arg === '-t') {
      options.target = args[index + 1]
      index += 1
      continue
    }

    if (arg.startsWith('--json=')) {
      options.json = arg.slice('--json='.length)
      continue
    }

    if (arg === '--json' || arg === '-j') {
      options.json = args[index + 1]
      index += 1
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

function printHelp() {
  console.log(`npm-lens ${VERSION}

Usage:
  npm-lens analyze [options]

Options:
  -d, --depth <n>       Limit dependency traversal depth. Default: 2
  -t, --target <path>   Target project path. Default: current directory
  -j, --json <path>     Save analysis JSON and do not open a report page
      --ai              Print an AI/rule-based report instead of the raw graph
  -h, --help            Show help
  -v, --version         Show version

Examples:
  npm-lens analyze
  npm-lens analyze --depth=3
  npm-lens analyze --target=/Users/me/project
  npm-lens analyze --json=deps.json
  npm-lens analyze --ai
`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
