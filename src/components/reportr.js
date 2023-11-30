define((require, exports, module) => {
  return {
    send(reportUrl, {
      logStorage = {},
      logEntries = [],
      filter,
      cpRefer,
      extParams,
      clear = true } = {}) {
        let t, 
          buff, 
          s,
          o,
          dataMap = new FormData();

        //TODO
        //dataMap.append("timing", ""); 

        buff = Array.from(logStorage[filter] || logEntries);
        dataMap.set("log", buff.join('\n'));

        if(t = extParams){
            for(let k in t){
                if("log" == k.toLowerCase()) continue;
                if("string" == typeof t[k]) dataMap.append(k, t[k]);
            }
        }

        try {
          t = new URL(reportUrl);
        } catch(err) {
          cpRefer.error(`${err} \nConsole-Plus: report: send: Invalid report URL string.`);
          return;
        }

        s = new AbortController();
        o = setTimeout(() => {
          s.abort();
          cpRefer.error("Console-Plus: report: send: Fetch 3s timeout.");
        }, 3000);

        fetch(t, {
          "method": "POST",
          "priority": "low",
          "mode": "cors",
          "signal": s.signal,
          "body": dataMap
        }).then(resp => {
          if("function" == typeof resp.json){
            return resp.json();
          }
        }).then(dt => {
          cpRefer.info(JSON.stringify(dt));

        }).catch(err => {
          cpRefer.error("Console-Plus: report: send:", err);
        }).finally(() => {
          clearTimeout(o);
        });
    }
  };
});