# console-plus

Web / WebView 专用的「现场黑匣子」：业务代码照常写 `console.log`，日志被零侵入地收集到有界内存快照，按条件 flush 到 `localStorage`，排障时再上报到你的日志服务。零运行时依赖，仅面向浏览器与现代 WebView，不做 Node 与旧环境兼容。

## 四条设计原则

- **不侵入**：原生输出永远先发生，收集逻辑的任何异常都被吞掉；`inject()` 可逆，且检测到宿主 App 或其他 SDK 之后又包装了 console 时，`restore()` 绝不覆盖别人的引用。
- **不丢现场**：页面隐藏、离开、达到条数或时长都会把内存快照同步 flush 到本地存储；下次页面起来可以继续回传遗留批次。
- **可插拔**：核心只定义 `Reporter` 接口，内置 HTTP 上报器只是默认实现，随时换成 JS Bridge、Beacon 等任意通道。
- **有界**：结构化记录 + 环形缓冲，本地队列有体积上限与最旧批次淘汰，不会撑爆内存或 localStorage。

## 安装

```bash
npm install console-plus
```

```js
import { createWebConsolePlus } from "console-plus";
import { createHttpReporter } from "console-plus/reporters/http";
```

不打包的页面 / WebView 可以直接用 IIFE 产物 `dist/console-plus.global.js`，全局对象为 `window.ConsolePlus`：

```html
<script src="./console-plus.global.js"></script>
<script>
  const cp = ConsolePlus.createWebConsolePlus({ productName: "app" });
  cp.inject();
</script>
```

WebView 里建议把该文件**打包进 app assets 本地加载**，不要依赖远程 CDN（离线、白屏、劫持）。

## 快速开始

```js
import { createWebConsolePlus } from "console-plus";

const cp = createWebConsolePlus({
  productName: "myApp",
  maxEntries: 5000,
  reportUrl: "https://your-log-host/collect",
  persistence: {
    flushThreshold: 100, // 未持久化日志达到 100 条
    flushIntervalMs: 5000, // 或距上次 flush 超过 5s
    watchPageHide: true, // 或 pagehide / visibilitychange(hidden)
  },
});

cp.inject(); // 之后所有原生 console.* 调用都会被收集
console.log("这条也会被收集", { uid: 42 }, Symbol("safe"));

console.log(cp.get()); // \t 分隔文本，行以 \n 分隔
console.log(cp.records({ level: "error" })); // 结构化记录

const result = await cp.report({ params: { uid: 42 } });
if (!result.ok) console.warn("上报失败，本地批次会保留待下次重试", result.error);
```

`createWebConsolePlus()` 默认开启持久化；`createConsolePlus()` 与默认实例 `cp` 默认**关闭**持久化（写用户本地存储需要显式开启）。

## 配置

`createWebConsolePlus(options)`、`createConsolePlus(options)` 与 `cp.config(patch)` 接受同一组基础字段；`config()` 只更新传入的字段。

| 字段          | 默认值           | 说明                                                           |
| ------------- | ---------------- | -------------------------------------------------------------- |
| `productName` | `"console-plus"` | 每条日志的产品列                                               |
| `maxEntries`  | `10000`          | 内存快照容量，正整数；WebView 内存紧张时建议 2000–5000         |
| `silentMode`  | `false`          | `true` 时仍收集，但不输出到原生 console                        |
| `reportUrl`   | `""`             | 上报地址，支持同源相对路径（如 `/collect`），仅允许 http/https |
| `reporter`    | —                | 自定义 `Reporter`，优先级高于 `reportUrl`                      |
| `redact`      | `true`           | 上报前脱敏；`false` 关闭，传函数可自定义                       |
| `autoInject`  | `false`          | 构造时立即注入（默认惰性）                                     |
| `persistence` | 见下             | `false` / `true` / 配置对象                                    |
| `clock`       | 自动             | 注入时钟，便于测试                                             |

### persistence 配置

| 字段              | 默认值                 | 说明                                          |
| ----------------- | ---------------------- | --------------------------------------------- |
| `storage`         | `localStorage`         | 可换 `sessionStorage` 或自定义 `Storage`      |
| `key`             | `"console-plus:queue"` | 本地队列键名                                  |
| `maxBytes`        | `512 * 1024`           | 队列体积上限，超出淘汰最旧批次                |
| `flushThreshold`  | `200`                  | 内存中未持久化日志达到该条数即 flush          |
| `flushIntervalMs` | `10000`                | 定时 flush 间隔，最小 100ms                   |
| `watchPageHide`   | `true`                 | 监听 `pagehide` 与 `visibilitychange(hidden)` |

存储不可用（隐私模式、WebView 禁用存储、配额耗尽）时 `cp.persisted === false`，自动退化为纯内存模式，不会抛给业务。

## API

| 方法                                            | 说明                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `cp.log / info / debug / warn / error(...args)` | 先输出原生 console，再收集一条日志                                       |
| `cp.config(patch)`                              | 合并配置并返回当前快照                                                   |
| `cp.records({ level }?)`                        | 返回 `LogRecord[]` 快照                                                  |
| `cp.get({ level }?)` / `cp.get("error")`        | `\t` 分隔文本，行统一 `\n`，列内 tab/换行已转义                          |
| `cp.flush()`                                    | 立即把未持久化日志写入本地，返回写入条数；幂等                           |
| `cp.clear({ console: true }?)`                  | 清空内存与本地队列，可选同时清控制台                                     |
| `cp.inject()` / `cp.restore()`                  | 注入/恢复宿主 console；被外部覆盖时 `restore()` 返回 `false`，可稍后重试 |
| `cp.setReporter(reporter \| null)`              | 替换或移除上报通道                                                       |
| `cp.report(options)`                            | 返回 `Promise<ReportResult>`                                             |
| `cp.dispose()`                                  | 最后 flush 一次，卸载监听与定时器，恢复 console 并停止工作               |

只读属性：`cp.settings`、`cp.size`、`cp.injected`、`cp.persisted`、`cp.disposed`。

`LogRecord`：`{ seq, level, product, elapsedMs, wallTime, args, message }`。`elapsedMs` 来自 `performance.now()`，`wallTime` 为 ISO 8601。

## 本地持久化与崩溃语义

写入单元是「批次」：每次 flush 把内存中尚未持久化的记录作为一个 `StoredBatch` 追加到 `localStorage` 的队列里，记录以紧凑字段存储（`seq / level / product / elapsedMs / wallTime / message`），体积上限内按最旧批次淘汰。

三类触发条件（满足任一即同步 `flush()`）：

1. 内存中未持久化日志达到 `flushThreshold` 条 —— 高频日志场景；
2. 距上次 flush 超过 `flushIntervalMs` —— 低频但持续运行；
3. `pagehide` / `visibilitychange(hidden)` —— 页面跳转、切后台、WebView 被回收前。

`cp.report()` 的流程：先 `flush()` 保住最新日志 → 读取本地所有批次（含上一次页面遗留的）→ 逐批构造 `ReportBatch` 上报 → **成功后按 seq 精确删除**该批次已发送的记录，其余级别继续保留 → 同步清理内存中对应记录。失败的批次原地保留，下次调用自动重试。

关于「崩溃前」要说清楚：Web 没有进程崩溃钩子，进程被系统强杀时无法执行任何回调。上面三重触发保证的是**最多丢最近 `min(flushThreshold, 一个 flushIntervalMs 内产生的条数)`**；绝大多数 WebView 回收前会先派发 `visibilitychange` 或 `pagehide`，这部分现场能同步落盘。想进一步降低丢失量就调小 `flushThreshold` 与 `flushIntervalMs`，代价是更频繁的 localStorage 写入。

也可以用 `LocalLogStore` 直接管理队列：

```js
import { LocalLogStore } from "console-plus";

const store = new LocalLogStore({ maxBytes: 256 * 1024 });
console.log(store.available, store.read());
store.removeSent(batchId, new Set([1, 2, 3]));
```

## 内置 HTTP 上报器

```js
import { createHttpReporter } from "console-plus/reporters/http";

cp.setReporter(
  createHttpReporter({
    url: "https://your-log-host/collect",
    timeoutMs: 3000,
    retries: 2,
    retryDelayMs: 300,
    includeTiming: true,
  }),
);
```

请求为 `POST`，body 一律是 `FormData`：`log` 是 `\n` 分隔文本，`timing`（navigation timing，WebView 可能为空）和 `params` 是同级字段。multipart/form-data 属于 CORS simple request，不触发额外预检；自定义 `headers` 会触发预检，老 WebView 上慎用。

成功判定默认：HTTP 2xx，且响应体为空、`code === 0` 或 `success === true`；可用 `isSuccess` 自定义。204、非 JSON 响应不会抛错；超时用 `AbortController`，失败按指数退避重试，`finally` 中必定清理定时器。

## 自定义 Reporter（WebView JS Bridge）

```js
cp.setReporter({
  async send(batch) {
    window.NativeBridge.postMessage("log", {
      text: batch.text,
      count: batch.count,
      createdAt: batch.createdAt,
    });
    return { ok: true, sent: batch.count, attempts: 1 };
  },
});
```

`batch` 为 `{ product, level?, count, text, records, params, timing?, createdAt }`。若 WebView 没有 `fetch` 或被客户端拦截，走 Bridge 比内置上报器更可靠。

## 脱敏

默认开启，只作用于**上报数据**：内存记录、本地队列与控制台输出保持原样。会打码 `token=...`、`password: ...`、JWT，以及 `authorization` / `api-key` / `cookie` 等敏感参数键。

```js
const cp = createWebConsolePlus({ redact: false });
const cp2 = createWebConsolePlus({
  redact: (batch) => ({ ...batch, text: batch.text.replace(/uid=\d+/g, "uid=*") }),
});
```

自定义脱敏函数抛错时会上报失败，而不是发送未脱敏数据。

## WebView 注意点

- `inject()` 与宿主 App 的 console hook 可能叠加；`restore()` 只还原仍由自己占据的位置，不会破坏别人的包装，被占用时返回 `false`。
- `pagehide` / `visibilitychange` 在部分 WebView 只派发其中之一，两者都监听；关键场景还可以自行在业务节点调用 `cp.flush()`。
- `localStorage` 可能被禁用或配额很小，用 `cp.persisted` 判断，并考虑调小 `maxBytes`。
- 日志含用户输入时请先评估脱敏与合规，避免把敏感信息长期留在本地存储里。

## 从 v1 迁移

旧版文件完整保留在 `archive/v1/`。v1 的 `componentUrl` 动态导入、手写 `.d.ts`、`silent`、`extParams`、双队列、`\r\n` 分隔、不可逆 `inject()` 均已移除；对应替代为 `Reporter` 接口、构建生成的 `.d.ts`、`silentMode`、`params`、单一环形缓冲、统一 `\n`、`restore()`。

## 浏览器集成测试页（纯静态）

`tests/browser/index.html` 是**纯静态 HTML**：所有脚本都用普通 `<script>` 标签加载（`dist/console-plus.global.js` + `harness.js`），样式外置到同目录的 `style.css`，都走相对路径，可以直接以 `file://` 双击打开，不需要任何静态服务器。页面加载后自动执行 11 个用例，实时展示 PASS/FAIL、耗时、内存条数、本地待上报批次与接收服务次数。

### 一键启动（VS Code）

按 `F5` 选择「**console-plus · 一键集成测试**」compound 配置：同时启动 `scripts/collector.mjs`（Node 接收服务）并在调试器里打开静态页，配合 source map 可直接给 `src/*.ts` 打断点。`.vscode/launch.json` 另外提供接收服务单独启动配置，以及打开当前 HTML 文件的通用配置。

手动方式：

```bash
npm run build
npm run collector
```

然后双击 `tests/browser/index.html`（或交给任意静态托管 / Live Server）。

### 接收服务只做接收

`npm run collector` 不提供任何页面资源，只在 `http://127.0.0.1:4173/__collect` 接收上报，并带完整 CORS 头：回显请求 `Origin`（无 `Origin` 时回退 `*`）+ `Vary: Origin`，OPTIONS 预检同样回显，并带 `Access-Control-Allow-Private-Network: true`，因此 `file://`（`Origin: null`）或任意本地域页面都能跨域提交，也满足 Chrome PNA 预检对精确 `Origin` 的要求。GET 返回最近接收记录，POST 返回 `{ code: 0 }`，加 `?fail=1` 返回 `{ code: 500 }` 模拟拒绝。页面顶部的「接收端」输入框可改地址，也可用 `?collector=` 覆盖；服务未启动会在页面上给出提示。

覆盖：原生 `console.*` 零侵入拦截（Symbol / 循环引用 / BigInt）、结构化记录与分级视图、非法级别防护、条数阈值 flush、`pagehide` 与 `visibilitychange(hidden)` flush、跨域 FormData 上报与队列清理、脱敏只作用于上报数据、失败批次保留、`restore()` 不覆盖其他 SDK 的包装、IIFE 全局产物。

点「模拟页面重载」会**真实刷新页面**：先把一条日志 flush 进 localStorage，重载后的新页面自动读取遗留批次并回传，用来验证跨页面生命周期的现场恢复。

## 开发

```bash
npm install
npm run check   # typecheck + lint + format:check + vitest
npm run build   # ESM + IIFE + .d.ts -> dist/
```

运行在浏览器 / WebView；Node 仅用于构建与测试工具链（CI 用 Node 22）。测试运行在 happy-dom 的 Web 环境。

## License

MIT
