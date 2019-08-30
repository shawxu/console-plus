define(function(require, exports, module){
    const EFN = () => {}
    , LOG_MAP = {
        debug  : 'debug'
        , error: 'error'
        , info : 'info'
        , log  : 'log'
        , warn : 'warn'
    }
    , LT_PERFORMANCE_TIME = 3
    , SAY_HI = 'console-plus loaded, hello world!'
    ;

    let proto = { //以chrome26的console method列表为准的方法列表，后续有可能增强除log体系外的其他方法
        assert          : EFN
        , clear         : EFN
        , count         : EFN
        , debug         : EFN
        , dir           : EFN
        , dirxml        : EFN
        , error         : EFN
        , group         : EFN
        , groupCollapsed: EFN
        , groupEnd      : EFN
        , info          : EFN
        , log           : EFN
        , markTimeline  : EFN
        , profile       : EFN
        , profileEnd    : EFN
        , time          : EFN
        , timeEnd       : EFN
        , timeStamp     : EFN
        , trace         : EFN
        , warn          : EFN
    }
    , logEntries = []
    , logEntry = [
        'console-plus' //product name
        , '' //log level
        , '' //absolute time
        , '' //performance now time
        , '' //log message
    ]
    , logStorage = {
        debug  : []
        , error: []
        , info : []
        , log  : []
        , warn : []                
    }
    , clearTimes = 0
    , reportUrl = 'http://i.qq.com/' //上报结果的接口URL，可配置
    , writeConsolePanel = false
    ;

    function consoleFactory(n){
        if(LOG_MAP[n]){
            return (...args) => {
                let t
                ;
                logEntry[1] = n;
                logEntry[LT_PERFORMANCE_TIME] = performance.now();
                logEntry[4] = args.join(' ');

                logEntries.push(t = logEntry.join('\t'));
                logStorage[n].push(t);
                writeConsolePanel && console[n].call(console, logEntry[4]);
            };
        } else {
            return (...args) => {
                console[n].apply(console, args);
            };
        }
    }

    for(let k in proto){
        //这里会侵染原生console
        //如果配置表里存在的方法原生console没有，这里会补空方法
        !console[k] && (console[k] = EFN);
        proto[k] = consoleFactory(k);
    }

    proto.config = (opts = {}) => {
        opts.productName && (logEntry[0] = opts.productName);
        opts.reportUrl && (reportUrl = opts.reportUrl);
        opts.writeConsolePanel && (writeConsolePanel = true);

        //TODO
    };

    proto.get = filter => {
        let r
        ;
        r = logStorage[filter] || logEntries;
        return r.join('\r\n');
    };

    proto.clear = clearConsole => {
        logEntries = [];
        for(let k in logStorage){
            logStorage[k] = [];
        }

        clearConsole && console.clear && console.clear();

        proto.info('console-plus cleared, ', ++clearTimes, 'times');
    };

    proto.report = (opts = {}) => {
        (require.async || require)(['./components/report'], rpt => {
                rpt.bootstrap({
                    'reportUrl'   : opts.reportUrl || reportUrl
                    , 'filter'    : opts.filter
                    , 'extParams' : opts.params
                    , 'clear'     : 'undefined' == typeof opts.clear ? true : opts.clear
                    , 'logStorage': logStorage
                    , 'logEntries': logEntries
                    , 'refer'     : proto
                });
            });
    };

    proto.info(SAY_HI);

    return proto;
});

