# Repository Guidelines

## Project Structure & Module Organization
本仓库是 `Vite + React + TypeScript` 的单页应用。核心路径按职责分层如下。
- `src/main.tsx`：应用启动、根组件挂载，以及 production service-worker registration；SW registration failure 必须 fail-open，不得阻断应用。
- `public/manifest.webmanifest` + `public/icons/`：installable PWA metadata/icon SSOT；`start_url` / `scope` 必须保持 relative，确保 root dev 与 GitHub Pages `/Public-API/` base 都成立。
- `vite.config.ts` 的 PWA shell plugin：只 precache initial entry JS/CSS、manifest/icons、favicon、machine catalog 与 shell HTML；固定文件名的 precache 资源必须把内容 revision 纳入 cache identity，不能只 hash URL，否则 manifest/icon/catalog-only 更新可能继续命中 stale cache；禁止 eager-cache lazy preview bundles，也禁止把 cross-origin provider response 写入 Cache Storage。
- `scripts/verify-pwa-app-shell.mjs`：production-like localhost PWA contract；验证 Chromium manifest/installability、SW scope/control、offline shell、base-path 与 cross-origin no-cache。不要把 synthetic provider fixture 当 live provider health evidence。
- `src/App.tsx`：页面/路由、API 选择、参数表单、Catalog 与 Request Lab UI orchestration；不要把 transport lifecycle 再塞回这个组件。
- `src/i18n.ts`：固定 Human UI chrome 的 locale SSOT；当前支持 English 与简体中文，包括 Collections / Providers / Tags / Health / Documentation 的固定 workspace chrome。不要复制 `apiCatalog.ts` 的 API/provider/field/business metadata 到翻译表。Locale 切换必须保持 API ID、provider/API identity、hash route、WebMCP/tool schema 和 machine catalog 不变，并同步更新 `<html lang>` 与持久化偏好。Provider/API/category/hostname 等原始 SSOT 内容在中文界面继续显示时，应使用局部 `lang="en"` 等 language-change semantics，而不是误标成中文。所有属于 Human UI chrome 的可见或 accessibility-only 文案都必须来自同一 locale SSOT，包括 `aria-label`、compact dialog/error screen-reader text，以及 mobile table 通过 `data-label`/CSS pseudo-content 显示的字段标签；不要留下只在小屏或 accessibility tree 才出现的硬编码英文。
- `src/apiCatalog.ts`：API 元数据单一事实源；所有 API 的 `id`、字段、`buildUrl`、请求头、解析策略都在此定义。
- Catalog search 也必须复用 `apiCatalog.ts` 的 `matchesApiSearch`；Human UI 与 WebMCP 不得各自维护不同的搜索语义。Matcher 会先忽略 bounded conversational boilerplate（例如 please/show/find/API）再匹配 capability tokens；只有真正的 domain synonym gap 才写进对应 API 的 `keywords` SSOT，避免靠无限 synonyms 修 prompt wording，并由 machine catalog 同步导出。
- `src/previewProfiles.ts`：API 与默认预览布局映射（如 `calendar-timeline`、`data-table`、`media-gallery`）。
- `src/responsePreview.tsx`：SSOT preview registry 与高层 composition；保持为 orchestration surface，不要继续把新的大型 domain adapter 塞回单体文件。
- `src/previews/CatalogFamilyPreviews.tsx`：跨多个 API 复用的 media/location/calendar/developer/security/research 等 family adapters 与通用 result fallback；不要在 registry 复制这些实现。
- `src/previews/SpecializedCatalogPreviews.tsx`：已有较小的 specialized catalog adapters 与尚未完成 semantic migration 的 bounded DataTable adapter；新的大型 API-owned semantic adapter仍应优先独立成文件。
- `src/previews/`：API-owned semantic adapters、shared semantic-card primitives 与 response-data helpers；domain adapter 优先放这里，再由 `responsePreview.tsx` 注册。
- `src/previews/semanticValidation.ts`：dedicated semantic adapters 共用的严格 provider-value primitives。需要“JSON number 必须真的是 number / integer、numeric string 不得静默 coercion、缺失 optional text 与 malformed text 必须区分”时优先复用这里；不要为了省 helper 而改用 `previewData.numberValue` 这类允许 numeric-string coercion 的展示型 helper，也不要在每个 adapter 重复一份完全相同的 `isRecord` / integer / optional-text parser。Domain-specific bounds、safe-integer identity、provider URL/ID normalization 仍留在各 adapter。
- `src/previews/previewBundles.tsx`：Request Lab preview 的 on-demand bundle loader；首次 browser load 使用 React `lazy` + 现有 Suspense boundary，已解析 bundle 可同步复用。禁止通过 render-time 手动 `throw Promise` 自建 Suspense loading contract。
- Preview CSS 跟随 ownership：`responsePreview.tsx` 只加载最小 shared/deferred `domainCards.css` shell/common state；Weather / CatalogFamily / Specialized / Market 与 Diagnostic / Operational / Semantic family-specific CSS 必须由对应 async bundle import。`DateList` / `SemanticCards` / station-list 等跨 family reusable primitive 由它们自己的 lazy dependency module 持有 CSS。所有 result-only CSS 都不得回流到 initial `styles.css`，避免 Catalog/Overview cold load 提前下载结果样式；family/primitive 的 responsive media rules 也必须留在同一个 lazy CSS owner，不能把 mobile override 放进更早加载的 `styles.css`，否则后加载的同-specificity desktop base rule 会重新覆盖 mobile contract。`test:browser:preview-bundles` 同时守住 initial CSS cold-load budget 与每个 result path 的显式 CSS dependency/budget。
- Semantic preview bundle 可以按 measured hot path 再做 bounded second-level split；当前 Jolpica/OpenDota/OpenLigaDB/MLB schedule 由 `SportsSemanticPreviewBundle.ts` / `sportsSemanticCards.css` 按需加载，Drug Label/Food Recall/RxNorm/UniProt/PDB/ChEMBL/PubChem/Ensembl 由 `ScienceSemanticPreviewBundle.ts` / `scienceSemanticCards.css` 按需加载，repository/community Developer adapters 由 `DeveloperSemanticPreviewBundle.ts` 按需加载，package-registry adapters 由 `PackageSemanticPreviewBundle.ts` / `packageSemanticCards.css` 按需加载。只有同一 browser harness 的 first-result byte/waterfall evidence 证明有明显收益时才新增类似边界。
- `src/PreviewLoadBoundary.tsx`：局部 containment for rejected preview chunks/render failures；只降级 semantic preview，保留 Request Lab 与 Raw JSON，并提供完整 application reload 作为 recovery。不要用同一 document 内重复 dynamic import 作为唯一恢复机制。
- `src/App.test.tsx` 与 `src/apiCatalog.test.ts`：页面集成、目录一致性、布局映射和 URL 组装回归。
- `src/useApiRequestRuntime.test.tsx`：独立验证 shared request runtime 的 success、invalid-response、HTTP classification、timeout、superseded-run cancellation 与 unmount cleanup；不要把 transport lifecycle 回归重新堆进 `App.test.tsx`。
- `src/webmcp.ts`、`vite.config.ts`：外部适配与构建配置。
- `src/useModalFocusTrap.ts`：共享 compact/modal overlay 的 focus containment、Escape close、scroll lock 与 invoker focus restore contract；不要在各组件重复实现一份。
- `src/useApiRequestRuntime.ts`：Human Request Lab 与 WebMCP 共用的 request lifecycle：validation、timeout、AbortController cancellation、stale-run protection、response parsing/error classification；successful run 还必须保留实际执行的 URL / method / body context，让 POST semantic adapter 能绑定真实 request，而不是从当前 form state 猜测。UI 只负责选择/显示状态，不要复制 transport state machine。

## Build、Test 与 Development Commands
- `npm install`：安装依赖。
- `npm run dev -- --host 0.0.0.0 --port 4173`：启动开发服务器。
- `npm run build`：执行 `tsc -b` 并构建生产产物到 `dist/`。`tsconfig.app.json` 同时启用 `noUnusedLocals` / `noUnusedParameters`，所以 semantic migration 后遗留的 dead import、未使用 local/parameter 会直接阻断 build；不要用关闭 compiler gate 的方式保留 dead code。
- `npm run preview`：本地验证生产构建是否可运行。
- `npm test`：执行完整测试套件。
- `npm run test:watch`：本地监听测试。
- `npm run test:browser:i18n`：在 real Pages origin + local unpublished bundle 下验证 English/简体中文 primary chrome、`html[lang]`、locale persistence、route/API identity、compact/modal focus handoff、390px overflow、核心 mobile touch targets（至少 44×44 CSS px）与 accessibility tree；不得触发 provider request。
- Responsive focus handoff 不可只依赖 breakpoint callback 当下的 `document.activeElement`：真实浏览器可能先因 CSS media query 隐藏 mobile-only control 而 blur，再派发 `matchMedia` change。需要从可信 open/modal state 推导 handoff target，并保留 browser regression 覆盖这个 blur-before-callback 顺序。
- Browser verifier 的 Chromium teardown 必须使用 `scripts/lib/browser-temp-profile.mjs` 的 shared termination/profile ownership helpers。Node `ChildProcess.exitCode` 在 signal termination 后仍可为 `null`，必须同时识别 `signalCode`；只有确认 child 已退出后才能立即删除 profile，否则保留给 owner-bound stale reaper，禁止误删可能仍活动的 profile。
- `npm run test:publish-readiness`：发布前的 bounded/policy-safe gate；运行 unit、Pages-base build、PWA install/offline-shell、i18n、preview bundle/failure recovery、native WebMCP/provider-policy 与 `npm run test:candidate-hygiene`，但不会做全量 live-provider sweep。Candidate hygiene 必须在不 staging 的前提下覆盖 tracked diff 与 `git ls-files --others --exclude-standard` 返回的 untracked candidate，检查 whitespace errors 与 unresolved conflict markers；不要退回只检查 `git diff --check`，因为它看不到 untracked local work。
- 常见提交流程：先跑 `npm test`，再跑 `npm run build` 复核类型与打包。

## Coding Style & Naming Conventions
- 全局采用 2 空格缩进，禁止制表符。
- `React` 组件使用 `PascalCase`，函数/变量使用 `camelCase`。
- `ApiDemo` 相关配置建议集中在 `apiCatalog.ts`，避免在其他文件拼接 URL。
- API ID 采用短横线小写（示例：`openverse-search`）。
- Provider 搜索/过滤参数必须来自当前官方文档/OpenAPI；不要依赖 provider 静默忽略的 query key。若 response 会 echo `search`/`filters`，browser E2E 应验证 provider 实际承认了该参数。
- Provider boolean query flags 也必须验证真实 wire semantics；有些 API 会按参数“是否存在”而不是字符串 `true/false` 解释布尔值。需要 full/expanded metadata 时应发送 provider 明确支持的 true 语义，不要依赖 `flag=false` 恰好被当成启用。
- Provider 参数存在 compatibility matrix（兼容组合）时，不要把彼此相关的自由控件暴露成可产生冲突组合的独立 SSOT。优先声明一个可枚举的用户意图字段，再在 `buildUrl` provider boundary 推导兼容参数；Human UI、machine catalog、WebMCP 必须只宣传真正可执行的组合。
- 有顺序关系的 date/year range 也属于 SSOT constraint：结束字段用 `minimumFromField` 指向开始字段，Human native `min`、shared validation、machine catalog 与 WebMCP discovery 必须从同一 metadata 派生。不要在 `buildUrl` 静默排序、夹紧或改写反向区间；无效 range 应在 provider network 前 fail closed。
- Numeric request normalization must distinguish a legitimate `0` from parse failure. Do not use falsy fallback patterns such as `parseInt(value) || fallback` when the field contract permits zero; validate discrete provider IDs with `select` options when the provider publishes an explicit finite method/code list.
- 日期字段优先使用 native `date` control；Human/agent SSOT 使用 `YYYY-MM-DD`，若 provider 要求其他日期格式，只在 `buildUrl` 边界转换，并用 provider echo 的 Gregorian/reporting date 做 browser E2E，避免 HTTP 200 掩盖日期误解析。
- 示例新增 API：
  1. 先在 `apiCatalog.ts` 增加定义。
  2. 在 `previewProfiles.ts` 加一条布局入口。
  3. 在 `src/previews/` 实现 API-owned semantic adapter，并在 `responsePreview.tsx` 注册。

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
- Request transport lifecycle 由 `src/useApiRequestRuntime.test.tsx` 直接覆盖；`App.test.tsx` 保留用户可见的 Request Lab / WebMCP integration contract，避免用整页 UI 测试重复 transport internals。
- 建议覆盖：成功返回、空结果、网络错误、超时、JSON 解析失败。

## Commit & Pull Request Guidelines
- 提交前缀常用：`feat`、`fix`、`refactor`、`test`、`chore`。
- PR 描述至少包含：变更概览、动机、影响范围、手工验证命令与结果。
- 涉及新 API 时，注明来源链接、限制条件、CORS 限制、以及字段缺失时的退化文案。

## Architecture Overview
`apiCatalog.ts`（元数据/请求定义）→ `useApiRequestRuntime.ts`（请求生命周期/解析/error semantics）→ `App.tsx`（页面与 UI orchestration）→ `previewProfiles.ts`（布局）→ `responsePreview.tsx`（渲染）。
建议优先通过 `usageNote` 标注速率、归属地或授权边界，避免在组件中写死业务规则。

## Security & Configuration Tips
- 禁止提交 API key、token、`.env` 与敏感凭据。
- 错误提示应统一处理 `CORS` 拒绝、429、超时和无效 JSON。
- 公开素材与引用数据需保留授权说明与展示边界。
- Provider automation/platform restrictions are executable policy, not only prose: encode explicit automation prohibitions in the catalog SSOT with an official policy link, fail closed for structured agent execution, and do not send autonomous live probes to manual-only public endpoints. Provider-specific automated-verification cadence/backoff also belongs in the SSOT when official policy requires it; generic health sweeps must exclude cadence-limited endpoints rather than repeatedly probing them, and an otherwise enabled provider may explicitly disable same-run retries for provider-documented rate-limit statuses (for example HTTP 429, or GitHub's documented 403/429 pair) when its official guidance requires backoff. Rate limits, attribution, caching, or identification requirements alone do not automatically mean `manual-only`; keep those as bounded usage constraints unless the provider explicitly restricts automation/platform use. If a mandatory provider contract (for example an application-identifying `User-Agent`) cannot be satisfied by a normal browser, the endpoint is not browser-ready and should be replaced or removed rather than left behind a warning.

## Product North Star & Agent Compatibility
- 对 provider 有机器可验证格式的 text field（例如固定长度代码、规范化标识符）优先在 `ApiField` SSOT 声明 constraint，并同步 Human DOM、shared validation、machine catalog、WebMCP discovery；builder 只可对**已验证的合法表示**做 provider-boundary normalization，不可用宽松 sanitization 把 malformed input 静默改成另一个请求。
- 产品目标不是最大 API 目录，而是高质量、browser-native、同时服务 human/developer 与 AI agent 的 Public API workbench。
- 重大 UI/interaction 修改必须遵守 `docs/product-north-star-and-agent-architecture.md` 的 Agent-Readable DOM Contract：优先 semantic HTML/native controls；所有重要 action 有 clear accessible name；custom control 提供等价 ARIA/keyboard semantics；不要让 AI agent 依赖截图、颜色、icon 或全文 highlight 才能理解操作。
- Accessibility 同时视为 AI usability infrastructure；重要信息不能只存在于 chart/SVG/map/color，必须从同一个 semantic ViewModel 提供 agent-readable text/DOM。
- API-owned semantic adapter 必须对 provider 的已知 response contract 保持语义诚实：HTTP 2xx 只代表 transport success，不能用 `Live`、零值或跨树 recursive fallback 把缺失的 provider 字段伪装成有效业务数据。已知 schema 缺失时用明确的 `data-result-state`（如 `invalid` / `empty` / `partial` / `ready`）fail closed；partial UI 的缺失值显示为 unavailable/`—`，不能制造看似真实的 placeholder measurement。
- Provider 若明确把某个成功状态码定义为“no result / no content”（例如 WoRMS `AphiaRecordsByName` 的 HTTP 204），必须在该 API 的 SSOT 里显式声明并映射到正确的 semantic empty data；不要全局把空 2xx body 当成 empty。未声明的空 JSON success 仍应 `invalid-response` fail closed，developer fetch sample 必须与同一 SSOT 契约一致。
- WebMCP 是可选的 structured agent surface，不得成为唯一 AI 入口；普通网页在无 WebMCP 环境仍须可通过 accessibility tree 完成 discover → search → select → configure → run → read result。
- WebMCP imperative tool registration 必须跨普通 React state/selection 变化保持稳定；不要让 callback identity churn 触发 teardown/re-register 并中断 in-flight tool invocation。浏览器 E2E 应在可用时验证原生 `document.modelContext`，mock 仅作为 unit-level 补充。
- Field validation 是 SSOT contract：number 使用 `min/max`，text 使用 `minLength/maxLength`，select 必须验证 value 属于 declared options；Human native controls、WebMCP discovery、`api-catalog.json` 与 shared request runtime 必须保持同义，并在 provider network 前 fail closed。Structured/runtime parameters 也必须严格限制为该 API 的 declared field IDs；unknown keys 必须在 network 前拒绝，`buildUrl` / `buildBody` 不得偷偷读取未暴露在 catalog SSOT 的 hidden parameter。
- `api-catalog.json` 是从 `apiCatalog.ts` build/dev-time 生成的 machine-readable fallback；禁止手工维护第二份 catalog。Catalog/policy schema 变更必须同步验证 JSON artifact、head discovery、Agent Tools link 与 WebMCP policy semantics 来自同一 SSOT；artifact 不得伪造 live health。
- 自主优化规则见 `docs/autonomous-optimization-loop.md`。Scheduled/local autonomous work 可以研究、修改、测试并更新 KB-MCP，但未收到用户明确 publication 指令前不得 commit、push、开 PR 或 merge。
