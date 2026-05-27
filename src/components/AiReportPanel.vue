<template>
  <aside class="ai-panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">AI Dependency Agent</p>
        <h2>依赖分析助手</h2>
      </div>
      <el-tag :type="report?.mode === 'openai' ? 'success' : 'info'">
        {{ report?.mode === 'openai' ? 'OpenAI' : '本地规则' }}
      </el-tag>
    </div>

    <el-empty v-if="!report" description="点击分析后生成报告" />

    <template v-else>
      <p class="summary">{{ report.summary }}</p>

      <section>
        <h3>风险观察</h3>
        <ul>
          <li v-for="item in report.risks" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section>
        <h3>优化建议</h3>
        <ul>
          <li v-for="item in report.recommendations" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section>
        <h3>下一步</h3>
        <ul>
          <li v-for="item in report.nextActions" :key="item">{{ item }}</li>
        </ul>
      </section>
    </template>
  </aside>
</template>

<script setup>
defineProps({
  report: {
    type: Object,
    default: null
  }
})
</script>
