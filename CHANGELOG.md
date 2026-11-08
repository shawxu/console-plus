# Changelog

## 2.1.0

面向浏览器 / WebView 的专项迭代，移除 Node 与旧环境兼容分支。

### 移除

- 不再产出 CJS、不再声明 Node 运行时支持；移除 Node 示例与 Node 编码分支。
- 上报统一使用 `FormData`（simple request，避免多余 CORS 预检）；时间戳直接用 `performance.now()`；`fetch` / `AbortController` / `localStorage` 按 Web API 使用，不再做老环境降级。
- 测试环境切换为 happy-dom，构建目标提升到 ES2022。

### 新增

- `LocalLogStore` + `createWebConsolePlus()`：把内存快照分批 flush 到 `localStorage`，带体积上限与最旧批次淘汰，配额异常或隐私模式自动降级。
- 三类 flush 触发：未持久化日志达到 `flushThreshold` 条、距上次 flush 超过 `flushIntervalMs`、`pagehide` / `visibilitychange(hidden)`。
- `cp.flush()` 可手动触发；`cp.report()` 优先回传本地遗留批次，成功后按 seq 精确删除，失败保留待下次重试。
- `persistence` 默认关闭（写用户本地存储需显式开启），`createWebConsolePlus()` 一键启用 web 推荐配置。
- 浏览器集成测试页改为**纯静态 HTML**（IIFE 普通脚本 + `file://` 直开），Node 端收窄为仅 CORS 接收服务 `npm run collector`；`.vscode/launch.json` 提供一键 F5 调试（同时启动接收服务并打开页面）。
- 修复 `clear()` 后未持久化计数虚高，导致清空队列后第一条日志误触发阈值 flush。
- 修复 `validateReportUrl()` 拒绝同源相对路径（如 `/collect`）；浏览器集成页首次运行即暴露该问题。

### 修复

- `restore()` 不再无条件覆盖宿主或其他 SDK 之后设置的 console 包装；检测到被外部覆盖时跳过该级别并明确返回失败，可稍后重试。

## 2.0.0

彻底重构。旧版源码、配置与文档原样保留在 `archive/v1/`。

### 破坏性变更

- 源码改为 TypeScript，类型声明由构建产物生成，不再手写可能漂移的 `.d.ts`。
- 入口改为构建产物 `dist/`；新增 ESM、CJS 与浏览器 IIFE 三种产物，`exports` 提供 `.`、`./reporters/http`、`./browser` 子路径。
- `config()` 改为只合并传入字段；`silentMode` 不再被后续调用重置。
- 日志改为结构化 `LogRecord` + 单一环形缓冲；分级只是读取视图，不再有全量/分级双队列。
- `get()` 与上报文本统一用 `\n` 分行，列内 tab/换行会被转义。
- `report()` 返回真实的 `ReportResult`；非法级别、`get()` / `records()` 的非法过滤值现在抛 `TypeError`。
- 上报方式由「动态 import 一个相对路径文件」改为可注入的 `Reporter` 接口；`componentUrl` 移除，改用 `setReporter()` / `report({ reporter })`。
- 成功上报后只清理已发送的那一批日志，不再全量 `clear()`。
- 追加参数 `params` 在所有环境统一规范为字符串；`extParams` 更名。
- 默认开启上报前脱敏；`redact: false` 可关闭，`redact: fn` 可自定义。

### 修复

- 日志序列化不再因 `Symbol`、循环引用、抛错的 getter 而中断业务代码；原生 console 输出永远先发生。
- `inject()` 现在可逆，新增 `restore()` 与 `dispose()`。
- 上报 URL 仅允许 http/https；修复原型污染风险、FormData/JSON 分支数据不一致、204/非 JSON 响应抛错、超时定时器泄漏、成功判定硬编码 `code === 0`。
- 时间戳拆成 `elapsedMs`（恒为相对毫秒）与 `wallTime`（ISO 8601），降级时语义不再突变。

### 工程

- 新增 vitest 测试、ESLint 9 flat config、Prettier、`npm run check`、GitHub Actions 多版本 CI、浏览器与 Node 示例。
- `package-lock.json` 纳入版本控制；`sideEffects: false`、`engines`、完整 `exports` 与 `files`。
