/**
 * console-plus - Enhanced console logger
 * ESM module, no AMD/RequireJS required
 */

const LOG_LEVELS = ["debug", "error", "info", "log", "warn"];
const MAX_LOG_ENTRIES = 10000;

const proto = {}
  , logEntries = []
  , logEntry = [
      "console-plus" //default product name
      , "" //log level
      , "" //performance now time
      , "" //log message
    ]
  , logStorage = {
      "debug":    []
      , "error":  []
      , "info":   []
      , "log":    []
      , "warn":   []
    }
  , originalConsole = {};

let reportUrlCfg = "" //上报结果的接口URL，可配置
  , injected = false
  , silent = false;

const now = (() => {
  if (typeof performance !== "undefined" && performance.now) {
    return () => performance.now().toFixed(3);
  }
  return () => Date.now().toString();
})();

const pushLog = (level, entry) => {
  if (logEntries.length >= MAX_LOG_ENTRIES) {
    logEntries.shift();
  }
  logEntries.push(entry);
  if (logStorage[level] && logStorage[level].length >= MAX_LOG_ENTRIES) {
    logStorage[level].shift();
  }
  logStorage[level].push(entry);
};

for (const k of LOG_LEVELS) {
  if (console[k] && "function" == typeof console[k]) {
    const prxy = new Proxy(console[k], {
      apply (tgt, thisArg, argArr) {
        logEntry[1] = k;
        logEntry[2] = now();
        logEntry[3] = argArr.join(" ");
        const t = logEntry.join("\t");
        pushLog(k, t);
        if(!silent){
          if(!injected){
            tgt(...argArr);
          } else {
            ("function" == typeof originalConsole[k]) && originalConsole[k](...argArr);
          }
        }

      }
    });

    proto[k] = prxy;
  }
}

proto.config = ({ productName = logEntry[0], reportUrl = reportUrlCfg, silentMode = false } = {}) => {
  if (productName && "string" == typeof productName) logEntry[0] = productName;
  if (reportUrl && "string" == typeof reportUrl) reportUrlCfg = reportUrl;
  silent = !!silentMode;
};

proto.get = filter => {
  const r = logStorage[filter] || logEntries;
  return r.join("\r\n");
};

proto.clear = clearConsole => {
  logEntries.length = 0;
  for (const k in logStorage) {
    logStorage[k].length = 0;
  }

  clearConsole && console.clear && console.clear();
};

proto.report = async ({
  componentUrl = "./components/reportr.js",
  reportUrl = reportUrlCfg,
  filter,
  params,
  clear = true
} = {}) => {
  const sd = await import(componentUrl);

  sd.default(reportUrl, {
    "filter":       filter
    , "extParams":  params
    , "clear":      clear
    , "logStorage": logStorage
    , "logEntries": logEntries
    , "cpRefer":    proto
  });
};

proto.inject = () => {
  if(!injected){
    for (const k of LOG_LEVELS) {
      if ("function" == typeof console[k]) {
        originalConsole[k] = console[k]; //把老的引用存起来
        console[k] = proto[k]; //inject掉
      }
    }
    injected = true;
  }
};

export default proto;

