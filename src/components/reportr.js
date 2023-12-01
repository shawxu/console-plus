define((require, exports, module) => {
  return {
    send(reportUrl, {
      logStorage = {},
      logEntries = [],
      filter,
      cpRefer,
      extParams,
      clear = true } = {}) {
        const [pTiming] = performance.getEntriesByType("navigation");

        let t, 
          buff, 
          s,
          o,
          dataMap = new FormData();

        if(pTiming.toJSON) {
          dataMap.append("timing", JSON.stringify(pTiming.toJSON()));
        }

        buff = Array.from(logStorage[filter] || logEntries);
        dataMap.append("log", buff.join('\n'));

        if(t = extParams){
            for(let k in t){
                if("log" == k.toLowerCase()) continue;
                if("string" == typeof t[k]) dataMap.append(k, t[k]);
            }
        }

        try {
          t = new URL(reportUrl);
        } catch(err) {
          cpRefer.error(`${err} \nconsole-plus: report: send: Invalid report URL string.`);
          return;
        }

        s = new AbortController();
        o = setTimeout(() => {
          s.abort();
          cpRefer.error("console-plus: report: send: Fetch 3s timeout.");
        }, 3000);

        fetch(t, {
          "method": "POST",
          "priority": "low",
          "mode": "cors",
          "signal": s.signal,
          "body": dataMap
        }).then(resp => {
          return resp.json();

        }).then(dt => {
          //cpRefer.info(JSON.stringify(dt));
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
  };
});