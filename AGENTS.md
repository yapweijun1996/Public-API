# Repository Guidelines

## Project Structure & Module Organization
本仓库是 `Vite + React + TypeScript` 的单页应用。核心路径按职责分层如下。
- `src/main.tsx`：应用启动与根组件挂载。
- `src/App.tsx`：API 选择、参数校验、请求执行、错误分支与结果路由。
- `src/apiCatalog.ts`：API 元数据单一事实源；所有 API 的 `id`、字段、`buildUrl`、请求头、解析策略都在此定义。
- `src/previewProfiles.ts`：API 与默认预览布局映射（如 `calendar-timeline`、`data-table`、`media-gallery`）。
- `src/responsePreview.tsx`：按 API ID 选择展示组件（卡片、表格、地图、时间线）。
- `src/App.test.tsx` 与 `src/apiCatalog.test.ts`：目录一致性、布局映射和 URL 组装回归。
- `src/webmcp.ts`、`vite.config.ts`：外部适配与构建配置。

## Build、Test 与 Development Commands
- `npm install`：安装依赖。
- `npm run dev -- --host 0.0.0.0 --port 4173`：启动开发服务器。
- `npm run build`：执行 `tsc -b` 并构建生产产物到 `dist/`。
- `npm run preview`：本地验证生产构建是否可运行。
- `npm test`：执行完整测试套件。
- `npm run test:watch`：本地监听测试。
- 常见提交流程：先跑 `npm test`，再跑 `npm run build` 复核类型与打包。

## Coding Style & Naming Conventions
- 全局采用 2 空格缩进，禁止制表符。
- `React` 组件使用 `PascalCase`，函数/变量使用 `camelCase`。
- `ApiDemo` 相关配置建议集中在 `apiCatalog.ts`，避免在其他文件拼接 URL。
- API ID 采用短横线小写（示例：`openverse-search`）。
- 示例新增 API：
  1. 先在 `apiCatalog.ts` 增加定义。
  2. 在 `previewProfiles.ts` 加一条布局入口。
  3. 在 `responsePreview.tsx` 注册渲染组件。

建议流程（3步）：
- 1) 新建/更新 API 条目与示例参数。
- 2) 在测试中加入 URL/参数断言。
- 3) 在本地执行 2 个命令确认：`npm test`，`npm run build`。

## Testing Guidelines
- 测试框架：`vitest` + `@testing-library/react`。
- 文件命名：`*.test.ts`、`*.test.tsx`。
- 新 API 需要同步更新两处测试：
  - `src/apiCatalog.test.ts`（长度、ID 唯一、`buildUrl` 结果断言）。
  - `src/App.test.tsx`（布局选择与组件注册覆盖）。
- 建议覆盖：成功返回、空结果、网络错误、超时、JSON 解析失败。

## Commit & Pull Request Guidelines
- 提交前缀常用：`feat`、`fix`、`refactor`、`test`、`chore`。
- PR 描述至少包含：变更概览、动机、影响范围、手工验证命令与结果。
- 涉及新 API 时，注明来源链接、限制条件、CORS 限制、以及字段缺失时的退化文案。

## Architecture Overview
`apiCatalog.ts`（元数据）→ `App.tsx`（请求与解析）→ `previewProfiles.ts`（布局）→ `responsePreview.tsx`（渲染）。
建议优先通过 `usageNote` 标注速率、归属地或授权边界，避免在组件中写死业务规则。

## Security & Configuration Tips
- 禁止提交 API key、token、`.env` 与敏感凭据。
- 错误提示应统一处理 `CORS` 拒绝、429、超时和无效 JSON。
- 公开素材与引用数据需保留授权说明与展示边界。
