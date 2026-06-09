# console-plus

增强型 console 日志工具，拦截并收集 `window.console` 的所有输出，按级别存储，可上报到指定接口。

---

## 安装

```bash
npm install console-plus
```

或在浏览器中直接引用：

```html
<script type="module">
  import cp from 'https://cdn.jsdelivr.net/npm/console-plus/src/console-plus.js';
  cp.info("loaded");
</script>
```

---

## 快速开始

### 浏览器（ESM）

```javascript
import cp from './src/console-plus.js';

cp.config({ productName: 'myApp' });
cp.info("console-plus loaded");

// 你的代码...
main.bootstrap();

cp.log("Hello world!");
cp.inject(); // 可选：把 console 方法注入回 window.console
```

### Node.js

```javascript
import cp from 'console-plus';

cp.config({ productName: 'server-log' });
cp.info("Server started");
```

### 构建压缩版

```bash
npx uglify-js src/console-plus.js -o dist/console-plus.min.js
```

---

## API

### cp.log / cp.info / cp.debug / cp.warn / cp.error

记录对应级别的日志，存储到内存队列，同时调用原生 `console` 方法。

```javascript
cp.info('enter function "main"');
cp.debug('tag 1', 'time 2');
cp.warn('param "opts" is undefined');
cp.error('error in function', this.toString());
cp.log('response OK', 'code 0');
```

### cp.config(opts)

全局配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `productName` | `'console-plus'` | 产品名称 |
| `reportUrl` | `''` (空，需自行配置) | 上报接口地址 |
| `silentMode` | `false` | 静默模式（不上报到原生 console） |

```javascript
cp.config({
  productName: 'myApp',
  silentMode: false
});
```

### cp.get(filter?)

获取收集的日志，格式为 `\t` 分隔的文本行。

```javascript
cp.get();       // 获取所有日志
cp.get('error'); // 只获取 error 级别
```

返回格式示例：
```
myApp	info	1234.899	console plus loaded
myApp	error	1245.678	something went wrong
```

### cp.clear(clearConsole?)

清空日志队列。

```javascript
cp.clear();       // 只清队列
cp.clear(true);    // 同时清空浏览器 console 面板
```

### cp.report(opts)

上报日志到服务端。

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `filter` | 无 | 只上报指定级别的日志 |
| `reportUrl` | 配置的地址 | 上报地址 |
| `params` | `{}` | 附加参数（如 uid 等） |
| `clear` | `true` | 上报后清空队列 |

```javascript
cp.report({
  params: { uid: '1234567', label: 'user log' },
  filter: 'error',
  clear: true
});
```

### cp.inject()

将 `cp.log/info/debug/warn/error` 注入回 `window.console`，让原生 `console.log()` 也能自动收集。

```javascript
cp.inject();
console.log("这条也会被收集"); // 不需要调 cp.log，直接用原生 console 即可
```

---

## 日志格式

每条日志为 `\t` 分隔的文本行：

```
productName\tlevel\ttimestamp\tmessage
```

| 字段 | 说明 |
|------|------|
| `productName` | 产品名，来自 `cp.config({ productName })` |
| `level` | 日志级别：`log` / `info` / `debug` / `warn` / `error` |
| `timestamp` | `performance.now()` 毫秒时间戳 |
| `message` | 所有参数的空格拼接 |

---

## 示例项目

参考 [test/](test/) 目录，包含浏览器和 Node.js 的完整示例。

---

## License

MIT