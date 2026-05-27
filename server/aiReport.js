import OpenAI from 'openai'

export function createRuleBasedReport(summary) {
  const licenseText = summary.topLicenses
    .map((item) => `${item.license}: ${item.count}`)
    .join(', ') || '暂无许可证数据'
  const duplicateText = summary.duplicatePackages
    ?.slice(0, 5)
    .map((item) => `${item.name}(${item.count}次)`)
    .join('、')

  return {
    mode: 'local-rule',
    title: '本地依赖分析报告',
    summary: `当前依赖图包含 ${summary.packageCount} 个包，直接依赖 ${summary.directDependencies} 个，最大遍历深度 ${summary.maxDepth}。`,
    risks: [
      summary.circularCount > 0
        ? `发现 ${summary.circularCount} 处循环依赖标记，需要人工确认是否影响打包。`
        : '当前样本中没有发现循环依赖标记。',
      summary.multiVersionPackages?.length
        ? `发现 ${summary.multiVersionPackages.length} 个包存在多版本实例。`
        : '当前样本中没有发现同包多版本实例。',
      summary.duplicatePackages?.length
        ? `发现 ${summary.duplicatePackages.length} 个包在依赖树中重复出现，例如 ${duplicateText}。这表示多个父依赖引用同名包，不等同于循环依赖。`
        : '当前样本中没有发现同名包重复出现在多条依赖路径中。',
      '建议优先检查 direct dependencies 的版本、许可证和维护状态。',
      `许可证分布：${licenseText}。`
    ],
    recommendations: [
      '为核心依赖建立定期升级清单，先升级 patch/minor 版本。',
      '把依赖图输出纳入 CI，避免依赖规模突然膨胀。',
      '对高层级传递依赖补充安全扫描，例如 npm audit 或第三方 SCA 工具。'
    ],
    nextActions: [
      '运行 npm install 后重新生成更完整的依赖图。',
      '配置 OPENAI_API_KEY 后获取更具体的 AI 风险解释。'
    ]
  }
}

export async function createAiReport(summary) {
  if (!process.env.OPENAI_API_KEY) {
    return createRuleBasedReport(summary)
  }

  const clientOptions = {
    apiKey: process.env.OPENAI_API_KEY
  }

  if (process.env.OPENAI_BASE_URL) {
    clientOptions.baseURL = process.env.OPENAI_BASE_URL
  }

  const client = new OpenAI(clientOptions)
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是资深 Node.js 依赖治理和软件供应链安全助手。只输出 JSON，不要 Markdown。'
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: '基于 NPM 依赖图摘要，生成中文依赖分析报告。',
            schema: {
              mode: 'openai',
              title: 'string',
              summary: 'string',
              risks: ['string'],
              recommendations: ['string'],
              nextActions: ['string']
            },
            summary
          })
        }
      ]
    })

    const content = response.choices[0]?.message?.content || '{}'
    return JSON.parse(content)
  } catch (error) {
    const provider = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `AI request failed. Check OPENAI_API_KEY, OPENAI_MODEL, and OPENAI_BASE_URL. Provider: ${provider}. Cause: ${message}`
    )
  }
}
