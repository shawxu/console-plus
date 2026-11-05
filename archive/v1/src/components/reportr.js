export default function (reportUrl, {
  logStorage = {},
  logEntries = [],
  filter,
  cpRefer,
  extParams,
  clear = true } = {}) {

    let t, 
      dataMap;

    // 兼容 Node.js 环境：优先用 FormData，不可用时用纯文本
    if (typeof FormData !== "undefined") {
      dataMap = new FormData();
    } else {
      dataMap = null;
    }

    // 尝试获取页面导航性能数据（浏览器环境）
    if (typeof performance !== "undefined" && performance.getEntriesByType) {
      const [pTiming] = performance.getEntriesByType("navigation");
      if (pTiming && pTiming.toJSON && dataMap) {
        dataMap.append("timing", JSON.stringify(pTiming.toJSON()));
      }
    }

    const buff = Array.from(logStorage[filter] || logEntries);
    const logBody = buff.join('\n');

    if (dataMap) {
      dataMap.append("log", logBody);
      t = extParams;
      if(t){
        for(const k in t){
          if("log" == k.toLowerCase()) continue;
          if("string" == typeof t[k]) dataMap.append(k, t[k]);
        }
      }
    }

    try {
      t = new URL(reportUrl);
    } catch(err) {
      cpRefer.error(`${err} \nconsole-plus: report: send: Invalid report URL string.`);
      return;
    }

    // 构建 body：优先 FormData，否则 JSON
    let body;
    const headers = {};
    if (dataMap) {
      body = dataMap;
    } else {
      headers["Content-Type"] = "application/json";
      const payload = { log: logBody };
      if (extParams) {
        for (const k in extParams) {
          if ("log" == k.toLowerCase()) continue;
          payload[k] = extParams[k];
        }
      }
      body = JSON.stringify(payload);
    }

    const s = new AbortController();
    const o = setTimeout(() => {
      s.abort();
      cpRefer.error("console-plus: report: send: Fetch 3s timeout.");
    }, 3000);

    fetch(t, {
      "method": "POST",
      "priority": "low",
      "mode": "cors",
      "signal": s.signal,
      "headers": headers,
      "body": body
    }).then(resp => {
      return resp.json();

    }).then(dt => {
      if(dt && dt.code === 0) {
        cpRefer.info(dt.msg);
        if(clear) {
          cpRefer.clear();
        }
      }
    }).catch(err => {
      cpRefer.error("console-plus: report: send: Response Exception:\n", err);
    }).finally(() => {
      clearTimeout(o);
    });
}
