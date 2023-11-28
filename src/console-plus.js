define((require) => {

  const LOG_MAP = {
      "debug": 1
      , "error": 1
      , "info": 1
      , "log": 1
      , "warn": 1
    };

  let proto = {}
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
    , clearTimes = 0
    , reportUrlCfg = "https://shawxu.cn/blog/add/" //上报结果的接口URL，可配置
    , injected = false
    , silent = false;

  function consoleFactory(n) {
    if (LOG_MAP[n]) {
      return (...args) => {
        let t;
        logEntry[1] = n;
        logEntry[2] = performance.now();
        logEntry[3] = args.join(" - ");

        logEntries.push(t = logEntry.join("\t"));
        logStorage[n].push(t);
        if(!silent){
          if(!injected){
            console[n](...args);
          } else {
            ("function" == typeof LOG_MAP[n]) && LOG_MAP[n](...args);
          }
        }
      };
    } else {
      return (...args) => {
        console[n](...args);
      };
    }
  }

  for (let k in console) {
    //给console-plus补上所有console原生的方法，可以代理调用
    if ("function" == typeof console[k]) {
      proto[k] = consoleFactory(k);
    }
  }

  proto.config = ({ productName = logEntry[0], reportUrl = reportUrlCfg, silentMode = false } = {}) => {
    if (productName && "string" == typeof productName) logEntry[0] = productName;
    if (reportUrl && "string" == typeof reportUrl) reportUrlCfg = reportUrl;
    silent = !!silentMode;
    //TODO
  };

  proto.get = filter => {
    let r = logStorage[filter] || logEntries;
    return r.join("\r\n");
  };

  proto.clear = clearConsole => {
    logEntries = [];
    for (let k in logStorage) {
      logStorage[k] = [];
    }

    clearConsole && console.clear && console.clear();

    proto.info("console-plus cleared, ", ++clearTimes, "times");
  };

  proto.report = ({
    componentUrl = "./components/report-xhrlv2",
    reportUrl = reportUrlCfg,
    filter,
    params,
    clear = true
  } = {}) => {
    require([componentUrl], rpt => {
      rpt.bootstrap({
        "reportUrl":    reportUrl
        , "filter":     filter
        , "extParams":  params
        , "clear":      clear
        , "logStorage": logStorage
        , "logEntries": logEntries
        , "refer":      proto
      });
    });
  };

  proto.inject = () => {
    if(!injected){
      for (let k in LOG_MAP) {
        if ("function" == typeof console[k]) {
          LOG_MAP[k] = console[k]; //把老的引用存起来
          console[k] = proto[k]; //inject掉
        }
      }
      injected = true;
    }
  };

  proto.info(logEntry[0], " loaded, hello world!");

  return proto; //export consolePlus
});

