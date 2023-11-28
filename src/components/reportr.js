define((require, exports, module) => {
  return {
    send(reportUrl, {
      logStorage = {},
      logEntries = [],
      filter,
      refer,
      extParams,
      clear = true } = {}) {
        let t, buff = [], dataMap = new FormData();

        dataMap.append("timing", ""); //TODO

        t = logStorage[filter] || logEntries;
        buff = buff.concat(t);

        dataMap.append("log", buff.join('\n'));

        if(t = extParams){
            for(let k in t){
                if("log" == k.toLowerCase()) continue;
                dataMap.append(k, t[k]);
            }
        }
    }
  };
});