export function summarizeGraph(graph) {
  const packages = []
  const licenses = new Map()
  const dependencyTypes = new Map()
  const versionsByName = new Map()
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
      packages.push({ name, parent, depth, license, version, type: dependencyType })
      licenses.set(license, (licenses.get(license) || 0) + 1)
      dependencyTypes.set(dependencyType, (dependencyTypes.get(dependencyType) || 0) + 1)
      if (!versionsByName.has(name)) {
        versionsByName.set(name, new Set())
      }
      versionsByName.get(name).add(version)
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
    missingCount,
    dependencyTypes: Object.fromEntries(dependencyTypes.entries()),
    multiVersionPackages: Array.from(versionsByName.entries())
      .map(([name, versions]) => ({ name, versions: Array.from(versions).sort() }))
      .filter((item) => item.versions.length > 1),
    topLicenses: Array.from(licenses.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([license, count]) => ({ license, count }))
  }
}
