define((require) => {
  'use strict';

  const LOG_MAP = {
      debug:    'debug'
      , error:  'error'
      , info:   'info'
      , log:    'log'
      , warn:   'warn'
    }
    , DEF_NAME = 'console-plus'
    , LT_PERFORMANCE_TIME = 3
    , SAY_HI = DEF_NAME + ' loaded, hello world!'
    ;

  let proto = {}
    , logEntries = []
    , logEntry = [
        DEF_NAME //default product name
        , '' //log level
        , '' //absolute time
        , '' //performance now time
        , '' //log message
      ]
    , logStorage = {
        debug:    []
        , error:  []
        , info:   []
        , log:    []
        , warn:   []
      }
    , clearTimes = 0
    , reportUrlCfg = 'https://shawxu.cn:3000/' //上报结果的接口URL，可配置
    , injected = false
    , silent = false;

  function consoleFactory(n) {
    if (LOG_MAP[n]) {
      return (...args) => {
        let t;
        logEntry[1] = n;
        logEntry[LT_PERFORMANCE_TIME] = performance.now();
        logEntry[4] = args.join(' - ');

        logEntries.push(t = logEntry.join('\t'));
        logStorage[n].push(t);
        if(!silent){
          if(!injected){
            console[n].apply(console, args);
          } else {
            proto['__' + n + '__'].apply(proto, args);
          }
        }
      };
    } else {
      return (...args) => {
        console[n].apply(console, args);
      };
    }
  }

  for (let k in console) {
    //给console-plus补上所有console原生的方法，可以代理调用
    if ('function' === typeof console[k]) {
      proto[k] = consoleFactory(k);
    }
  }

  proto.config = ({ productName = logEntry[0], reportUrl = reportUrlCfg, silentMode = false } = {}) => {
    if (productName && 'string' === typeof productName) logEntry[0] = productName;
    if (reportUrl && 'string' === typeof reportUrl) reportUrlCfg = reportUrl;
    silent = !!silentMode;
    //TODO
  };

  proto.get = filter => {
    let r = logStorage[filter] || logEntries;
    return r.join('\r\n');
  };

  proto.clear = clearConsole => {
    logEntries = [];
    for (let k in logStorage) {
      logStorage[k] = [];
    }

    clearConsole && console.clear && console.clear();

    proto.info('console-plus cleared, ', ++clearTimes, 'times');
  };

  proto.report = ({
    componentUrl = './components/report',
    reportUrl = reportUrlCfg,
    filter,
    params,
    clear = true
  } = {}) => {
    ('function' === typeof require) && require([componentUrl], rpt => {
      rpt.bootstrap({
        'reportUrl':    reportUrl
        , 'filter':     filter
        , 'extParams':  params
        , 'clear':      clear
        , 'logStorage': logStorage
        , 'logEntries': logEntries
        , 'refer':      proto
      });
    });
  };

  proto.inject = () => {
    if(!injected){
      for (let k in LOG_MAP) {
        if ('function' === typeof console[k]) {
          proto['__' + k + '__'] = console[k]; //把老的引用存起来
          console[k] = proto[k]; //inject掉
        }
      }
      injected = true;
    }
  };

  proto.info(SAY_HI);

  return proto; //export consolePlus
});

