# npm-lens

`npm-lens` 是一个 NPM 依赖分析 CLI。最终用户只需要在任意 Node 项目目录下运行 `npm-lens analyze`，工具会分析当前项目依赖，启动临时报表服务，并自动打开可视化报告页。

## 最终用户用法

```bash
npm-lens analyze
npm-lens analyze --depth=3
npm-lens analyze --target /Users/you/workspace/some-project
```

默认模式会：

1. 读取目标项目 `package.json`
2. 递归分析 `node_modules`
3. 生成 graph 和 summary
4. 启动动态端口 report server
5. 自动打开浏览器报告页

如果目标项目还没有安装依赖，`npm-lens` 仍会读取直接依赖声明，但传递依赖、真实安装版本和许可证信息会不完整。

## 输出模式

只保存 JSON，不打开网页：

```bash
npm-lens analyze --json=deps.json
```

只输出 AI/本地规则报告，不打开网页：

```bash
npm-lens analyze --ai
```

## 开发者用法

开发调试前端和 API 时才需要 Vite dev server：

```bash
npm install
npm run dev:all
```

正式 CLI report 模式不依赖 `npm run dev`、`npm run api` 或 `npm run dev:all`。发布包会包含已经构建好的 `dist`，CLI 自己启动 Express report server 托管页面。

构建前端：

```bash
npm run build
```

本地开发阶段直接运行 CLI：

```bash
npm run analyze
node main.js analyze --target /Users/you/workspace/some-project
```

## AI 配置

`--ai` 默认在没有 API Key 时使用本地规则报告。要接入真实大模型，复制环境变量文件：

```bash
cp .env.example .env
```

然后填写：

```env
OPENAI_API_KEY=你的密钥
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=
PORT=8787
```

如果使用 OpenAI 兼容接口，填写服务商的 base URL，例如：

```bash
export OPENAI_API_KEY="你的密钥"
export OPENAI_MODEL="服务商模型名"
export OPENAI_BASE_URL="https://api.deepseek.com/v1"
npm-lens analyze --ai
```

## 项目结构

```text
main.js              CLI 入口
server/              依赖图生成、本地 API、report server、AI 报告
src/components/      依赖图和 AI 报告组件
src/views/           首页和分析页
src/utils/           前端依赖图数据处理
src/assets/data/     前端默认依赖图数据
dist/                发布时包含的前端构建产物
```

## 发布前检查

`package.json` 当前仍保留 `"private": true` 作为开发保护。发布到 npm 前必须删除该字段或改为 `false`。

发布前确认：

```bash
npm install
npm run build
npm link
npm-lens analyze
```

## 提交到个人仓库

建议仓库名：

```text
npm-lens
```

初始化并推送：

```bash
git init
git add .
git commit -m "feat: implement npm-lens cli report workflow"
git branch -M main
git remote add origin https://github.com/<your-name>/npm-lens.git
git push -u origin main
```
