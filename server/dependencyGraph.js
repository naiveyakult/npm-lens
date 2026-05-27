import fs from 'node:fs'
import path from 'node:path'

export function readPackageJson(pkgPath) {
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  } catch {
    return null
  }
}

export function resolveProjectRoot(targetPath = process.cwd()) {
  return path.resolve(targetPath || process.cwd())
}

export async function generateDependencyGraph({ root = process.cwd(), depth = 2 } = {}) {
  const projectRoot = resolveProjectRoot(root)
  const packageJsonPath = path.join(projectRoot, 'package.json')
  const packageJson = readPackageJson(packageJsonPath)

  if (!packageJson) {
    throw new Error(`Cannot read package.json at ${packageJsonPath}`)
  }

  const dependencies = {
    ...(packageJson.dependencies || {})
  }
  const devDependencies = {
    ...(packageJson.devDependencies || {})
  }

  return {
    $project: {
      name: packageJson.name || path.basename(projectRoot),
      version: packageJson.version || 'unknown',
      root: projectRoot
    },
    ...walkDependencies({
      dependencies,
      root: projectRoot,
      depthLimit: Number(depth),
      dependencyType: 'production',
      visited: new Set()
    }),
    ...walkDependencies({
      dependencies: devDependencies,
      root: projectRoot,
      depthLimit: Number(depth),
      dependencyType: 'development',
      visited: new Set()
    })
  }
}

function walkDependencies({ dependencies, root, depthLimit, dependencyType, visited }) {
  const graph = {}

  if (!dependencies || depthLimit < 0) {
    return graph
  }

  for (const [name, versionRange] of Object.entries(dependencies)) {
    if (visited.has(name)) {
      graph[name] = { $versionRange: versionRange, $type: dependencyType, $circular: true }
      continue
    }

    const packageJsonPath = path.join(root, 'node_modules', name, 'package.json')
    const packageJson = readPackageJson(packageJsonPath)
    const childDependencies = packageJson?.dependencies || {}

    visited.add(name)
    graph[name] = {
      $type: dependencyType,
      $versionRange: versionRange,
      $version: packageJson?.version || versionRange || 'unknown',
      $description: packageJson?.description || '',
      $license: packageJson?.license || 'unknown',
      $installed: Boolean(packageJson),
      ...walkDependencies({
        dependencies: childDependencies,
        root,
        depthLimit: depthLimit - 1,
        dependencyType: 'transitive',
        visited
      })
    }
    visited.delete(name)
  }

  return graph
}

export function summarizeGraph(graph) {
  const packages = []
  const licenses = new Map()
  const dependencyTypes = new Map()
  const versionsByName = new Map()
  let circularCount = 0
  let missingCount = 0
  let maxDepth = 0

  function visit(node, depth, parent = null) {
    maxDepth = Math.max(maxDepth, depth)

    for (const [name, value] of Object.entries(node || {})) {
      if (name.startsWith('$')) {
        continue
      }

      const license = value?.$license || 'unknown'
      const dependencyType = value?.$type || 'unknown'
      const version = value?.$version || 'unknown'
      packages.push({
        name,
        parent,
        depth,
        type: dependencyType,
        installed: value?.$installed !== false,
        versionRange: value?.$versionRange || '',
        version,
        license,
        description: value?.$description || ''
      })
      licenses.set(license, (licenses.get(license) || 0) + 1)
      dependencyTypes.set(dependencyType, (dependencyTypes.get(dependencyType) || 0) + 1)
      if (!versionsByName.has(name)) {
        versionsByName.set(name, new Set())
      }
      versionsByName.get(name).add(version)
      if (value?.$circular) {
        circularCount += 1
      }
      if (value?.$installed === false) {
        missingCount += 1
      }
      visit(value, depth + 1, name)
    }
  }

  visit(graph, 1)

  return {
    packageCount: packages.length,
    directDependencies: Object.keys(graph || {}).filter((name) => !name.startsWith('$')).length,
    maxDepth,
    circularCount,
    missingCount,
    project: graph?.$project || null,
    dependencyTypes: Object.fromEntries(dependencyTypes.entries()),
    multiVersionPackages: Array.from(versionsByName.entries())
      .map(([name, versions]) => ({ name, versions: Array.from(versions).sort() }))
      .filter((item) => item.versions.length > 1),
    topLicenses: Array.from(licenses.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([license, count]) => ({ license, count })),
    packages: packages.slice(0, 80)
  }
}

export function saveGraph(graph, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2))
}
