/* 纯静态页面脚本：所有 API 都来自 IIFE 产物的 window.ConsolePlus，无 import / 无模块服务器。 */
(function () {
  const { createConsolePlus, createHttpReporter, createWebConsolePlus, LocalLogStore } =
    window.ConsolePlus;

  const DEFAULT_COLLECTOR = "http://127.0.0.1:4173/__collect";
  const QUEUE_KEY = "cp-integration:queue";
  const $ = (selector) => document.querySelector(selector);

  const results = [];
  const store = () => new LocalLogStore({ key: QUEUE_KEY });
  let httpReporter = null;

  const cp = createWebConsolePlus({
    productName: "integration-page",
    maxEntries: 500,
    persistence: {
      key: QUEUE_KEY,
      flushThreshold: 3,
      flushIntervalMs: 5000,
      watchPageHide: true,
      maxBytes: 128 * 1024,
    },
  });
  cp.inject();

  function collectorUrl() {
    const fromQuery = new URLSearchParams(location.search).get("collector");
    const input = $("#collector-url");
    const value = fromQuery || input.value.trim() || DEFAULT_COLLECTOR;
    input.value = value;
    return value;
  }

  function failingUrl() {
    const url = new URL(collectorUrl());
    url.searchParams.set("fail", "1");
    return url.toString();
  }

  function refreshHttpReporter() {
    httpReporter = createHttpReporter({ url: collectorUrl(), includeTiming: false });
    cp.setReporter(httpReporter);
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function reset() {
    cp.clear();
  }

  async function serverState() {
    const response = await fetch(collectorUrl());
    return response.json();
  }

  async function probeCollector() {
    try {
      await fetch(collectorUrl());
      return true;
    } catch {
      const banner = $("#banner");
      banner.classList.add("show");
      banner.textContent =
        "未检测到接收服务：请在 VS Code 按 F5 选择「console-plus · 一键集成测试」，或运行 npm run collector。HTTP 相关用例会失败。";
      return false;
    }
  }

  async function refreshStatus() {
    $("#stat-memory").textContent = String(cp.size);
    $("#stat-batches").textContent = String(store().read().length);
    $("#stat-persisted").textContent = cp.persisted ? "yes" : "no";
    $("#stat-injected").textContent = cp.injected ? "yes" : "no";
    $("#stat-iife").textContent = window.ConsolePlus ? "loaded" : "missing";
    $("#env-badge").textContent = `file:// · persisted=${cp.persisted} · injected=${cp.injected}`;
    try {
      const state = await serverState();
      $("#stat-server").textContent = String(state.count);
      const list = $("#server-items");
      list.replaceChildren();
      for (const item of state.items.slice(-3).reverse()) {
        const li = document.createElement("li");
        li.textContent = `${item.at.slice(11, 19)} · ${item.bytes} bytes`;
        list.append(li);
      }
    } catch {
      $("#stat-server").textContent = "unavailable";
    }
  }

  function renderResults() {
    const ok = results.filter((item) => item.ok).length;
    const bad = results.length - ok;
    $("#count-ok").textContent = `${ok} 通过`;
    $("#count-bad").textContent = `${bad} 失败`;
    $("#count-all").textContent = `${results.length} 总计`;
    $("#summary-text").textContent =
      results.length === 0 ? "尚未运行" : bad === 0 ? "全部通过" : "存在失败项";
    const bar = $("#progress");
    bar.style.width = results.length ? `${(ok / results.length) * 100}%` : "0%";
    bar.style.background = bad > 0 ? "var(--fail)" : "var(--pass)";

    const list = $("#results");
    list.replaceChildren();
    for (const item of results) {
      const li = document.createElement("li");
      const tag = document.createElement("span");
      tag.className = `tag ${item.ok ? "ok" : "bad"}`;
      tag.textContent = item.ok ? "PASS" : "FAIL";

      const body = document.createElement("div");
      body.className = "case";
      const title = document.createElement("b");
      title.textContent = item.name;
      const detail = document.createElement("p");
      detail.textContent = item.detail || "—";
      body.append(title, detail);

      const ms = document.createElement("span");
      ms.className = "ms";
      ms.textContent = `${item.ms.toFixed(0)}ms`;
      li.append(tag, body, ms);
      list.append(li);
    }
  }

  async function runCase(name, fn) {
    const started = performance.now();
    let ok = true;
    let detail = "";
    try {
      detail = (await fn()) ?? "";
    } catch (error) {
      ok = false;
      detail = error && error.message ? error.message : String(error);
    }
    results.push({ name, ok, detail, ms: performance.now() - started });
    renderResults();
  }

  const cases = [
    [
      "零侵入 console 拦截",
      () => {
        reset();
        const cyclic = {};
        cyclic.self = cyclic;
        console.log("integration: zero-intrusion", Symbol("s"), cyclic, 10n);
        const text = cp.get();
        assert(text.includes("integration: zero-intrusion"), "原生 console.log 未被收集");
        assert(text.includes("Symbol(s)"), "Symbol 未安全序列化");
        assert(text.includes("[Circular]"), "循环引用未安全序列化");
        assert(text.includes("10n"), "BigInt 未安全序列化");
        return `收集 ${cp.size} 条，业务调用未中断`;
      },
    ],
    [
      "结构化记录与分级视图",
      () => {
        reset();
        cp.info("info-marker-A", 1);
        cp.error("error-marker-B");
        const record = cp.records()[0];
        assert(record && record.seq > 0, "缺少 seq");
        assert(typeof record.elapsedMs === "number", "缺少相对时间");
        assert(record.wallTime.includes("T"), "缺少绝对时间");
        assert(record.product === "integration-page", "产品名未写入");
        assert(
          cp.get("error").includes("error-marker-B") && !cp.get("error").includes("info-marker-A"),
          "分级视图不正确",
        );
        assert(cp.records({ level: "error" }).length === 1, "结构化过滤不正确");
        return "字段齐全，get / records 分级视图一致";
      },
    ],
    [
      "非法级别显式失败",
      () => {
        reset();
        let threw = false;
        try {
          cp.get("trace");
        } catch (error) {
          threw = error instanceof TypeError;
        }
        assert(threw, "非法级别应抛 TypeError，而不是静默回落全量");
        return "TypeError 已抛出";
      },
    ],
    [
      "条数阈值自动 flush",
      () => {
        reset();
        cp.info("t1");
        cp.info("t2");
        assert(store().read().length === 0, "未达阈值不应提前写入");
        cp.info("t3");
        const batches = store().read();
        assert(batches.length === 1, `期望 1 个批次，实际 ${batches.length}`);
        assert(batches[0].records.length === 3, "批次内容不完整");
        return "达到 3 条即写入 1 个本地批次";
      },
    ],
    [
      "pagehide 同步 flush",
      () => {
        reset();
        cp.info("leaving");
        assert(store().read().length === 0, "前置状态不干净");
        window.dispatchEvent(new Event("pagehide"));
        const batches = store().read();
        assert(batches.length === 1, "pagehide 未触发 flush");
        assert(batches[0].records[0].m === "leaving", "落盘内容不符");
        return "页面离开前同步落盘";
      },
    ],
    [
      "visibilitychange(hidden) flush",
      () => {
        reset();
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        });
        try {
          cp.info("background");
          document.dispatchEvent(new Event("visibilitychange"));
          assert(store().read().length === 1, "切后台未触发 flush");
        } finally {
          Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => "visible",
          });
        }
        return "WebView 切后台场景落盘";
      },
    ],
    [
      "跨域 FormData 上报并清理队列",
      async () => {
        reset();
        cp.info("http-report-1");
        cp.error("http-report-2");
        const result = await cp.report({ params: { uid: "demo-1" } });
        assert(result.ok, `上报失败：${result.error ?? ""}`);
        assert(result.sent === 2, `期望发送 2 条，实际 ${result.sent}`);
        assert(store().read().length === 0, "本地批次未清理");
        assert(cp.size === 0, "内存队列未清理");
        const state = await serverState();
        assert(state.count > 0, "接收服务未收到请求");
        return `sent=${result.sent}，接收服务累计 ${state.count} 次`;
      },
    ],
    [
      "脱敏只作用于上报数据",
      async () => {
        reset();
        const captured = [];
        cp.setReporter({
          async send(batch) {
            captured.push(batch);
            return { ok: true, sent: batch.count, attempts: 1 };
          },
        });
        try {
          cp.info("token=abc123 password:hunter2");
          await cp.report({ clear: false });
          assert(captured.length === 1, "自定义 reporter 未收到批次");
          assert(captured[0].text.includes("[REDACTED]"), "上报数据未脱敏");
          assert(
            cp.records()[0].message === "token=abc123 password:hunter2",
            "内存记录不应被脱敏改动",
          );
        } finally {
          cp.setReporter(httpReporter);
        }
        return "上报打码，本地原文保留";
      },
    ],
    [
      "上报失败时本地队列保留",
      async () => {
        reset();
        cp.setReporter(createHttpReporter({ url: failingUrl(), includeTiming: false }));
        try {
          cp.info("keep-me");
          const result = await cp.report();
          assert(!result.ok, "服务端返回 code=500 时应判定失败");
          assert(store().read().length === 1, "失败批次应保留待重试");
        } finally {
          cp.setReporter(httpReporter);
          reset();
        }
        return "code=500 → 失败并保留批次";
      },
    ],
    [
      "restore 不覆盖其他 SDK 的包装",
      () => {
        const fake = {
          log: () => {},
          info: () => {},
          debug: () => {},
          warn: () => {},
          error: () => {},
        };
        const isolated = createConsolePlus({ target: fake, persistence: false, silentMode: true });
        isolated.inject();
        const ours = fake.log;
        const external = (...args) => ours(...args);
        fake.log = external;
        assert(isolated.restore() === false, "被外部占用时应返回 false");
        assert(fake.log === external, "不得覆盖别人的 console 包装");
        fake.log = ours;
        assert(isolated.restore() === true, "别人撤走后应能完整卸载");
        isolated.dispose();
        return "跳过外部 hook，可安全重试";
      },
    ],
    [
      "IIFE 全局产物可用",
      () => {
        assert(window.ConsolePlus, "window.ConsolePlus 不存在");
        assert(
          typeof window.ConsolePlus.createWebConsolePlus === "function",
          "IIFE 未导出 createWebConsolePlus",
        );
        return "纯静态页面无需模块服务器";
      },
    ],
  ];

  const reloadCase = [
    "跨页面重载后回传遗留批次",
    async () => {
      const batches = store().read();
      assert(batches.length >= 1, "重载前的本地批次丢失了");
      assert(
        batches.some((batch) =>
          batch.records.some((record) => record.m === "survived page reload"),
        ),
        "重载前写入的日志不在本地队列中",
      );
      const result = await cp.report();
      assert(result.ok && result.sent >= 1, `遗留日志回传失败：${result.error ?? ""}`);
      assert(store().read().length === 0, "成功后本地批次应清空");
      return `遗留 ${batches[0].records.length} 条，回传 ${result.sent} 条`;
    },
  ];

  async function runAll() {
    results.length = 0;
    renderResults();
    refreshHttpReporter();
    const buttons = [$("#run"), $("#reload")];
    for (const button of buttons) button.disabled = true;
    try {
      const phase = new URLSearchParams(location.search).get("phase");
      const active = phase === "reload" ? [reloadCase] : cases;
      for (const [name, fn] of active) {
        await runCase(name, fn);
        await refreshStatus();
      }
    } finally {
      for (const button of buttons) button.disabled = false;
      await refreshStatus();
    }
  }

  $("#run").addEventListener("click", runAll);
  $("#reload").addEventListener("click", () => {
    reset();
    cp.info("survived page reload");
    cp.flush();
    location.assign(`${location.href.split("?")[0]}?phase=reload`);
  });
  $("#clear").addEventListener("click", async () => {
    reset();
    results.length = 0;
    renderResults();
    await refreshStatus();
  });

  // 暴露 bootstrap Promise，方便自动化在 headless Web 环境里等待套件结束
  window.__consolePlusHarness = (async () => {
    refreshHttpReporter();
    const reachable = await probeCollector();
    const phase = new URLSearchParams(location.search).get("phase");
    if (phase === "reload" && reachable) {
      const banner = $("#banner");
      banner.classList.add("show");
      banner.textContent =
        "这是一次真实页面重载后的新页面：正在从 localStorage 读取遗留批次并回传。可点「运行全部测试」继续完整回归。";
    }
    await refreshStatus();
    await runAll();
  })();
})();
