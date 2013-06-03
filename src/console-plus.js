
('function' == typeof define) &&
	define(function(require, exports, module){
		var EFN = function(){}
		, APJ = Array.prototype.join
		, CPC = Function.prototype.call
		, LOG_MAP = {
			debug:			'debug'
			, error:		'error'
			, info:			'info'
			, log:			'log'
			, warn:			'warn'
		}
		, LT_ABS_TIME = 2
		, LT_PERFORMANCE_TIME = 3
		, proto = { //以chrome26的console method列表为准的方法列表，后续有可能增强除log体系外的其他方法
			assert:			EFN
			, clear:		EFN
			, count:		EFN
			, debug:		EFN
			, dir:			EFN
			, dirxml:		EFN
			, error:		EFN
			, group:		EFN
			, groupCollapsed:	EFN
			, groupEnd:		EFN
			, info:			EFN
			, log:			EFN
			, markTimeline:		EFN
			, profile:		EFN
			, profileEnd:		EFN
			, time:			EFN
			, timeEnd:		EFN
			, timeStamp:		EFN
			, trace:		EFN
			, warn:			EFN
		}
		, latencyType = LT_ABS_TIME
		, latencyMethod = function(){
			return (new Date()).valueOf();
		}
		, logEntries = []
		, logEntry = [
			'qzone' //product name
			, '' //log level
			, '' //absolute time
			, '' //performance now time
			, '' //log message
		]
		, logStorage = {
			debug:			[]
			, error:		[]
			, info:			[]
			, log:			[]
			, warn:			[]				
		}
		, reportUrl = 'http://i.qq.com/' //上报结果的接口URL，可配置
		, _wnd = window
		, _doc = document
		;
		
		latencyType = (_wnd.performance && performance.now) ?
			(latencyMethod = function(){ return performance.now(); }, LT_PERFORMANCE_TIME)
				:
			(Date.now ?
				(latencyMethod = function(){ return Date.now(); }, LT_ABS_TIME)
					:
				LT_ABS_TIME);

		function consoleFactory(n){
			if(LOG_MAP[n]){
				return function(){
					var t
					;
					logEntry[1] = n;
					logEntry[latencyType] = latencyMethod();
					logEntry[4] = APJ.call(arguments, ' ');

					logEntries.push(t = logEntry.join('\t'));
					logStorage[n].push(t);
					CPC.call(console[n], console, logEntry[4]);
					//console[n].call(console, logEntry[4]);
					//IE9不行，console.log之类的不是标准的Function类型，IE10,Chrome,FF之类都可以
				};
			} else {
				return function(){
					console[n].apply(console, arguments);
				};
			}
		}

		if(('object' == typeof _wnd) && _wnd.console){ //origin
		//if(_wnd.console = void(0)){ //DEBUG
			for(var k in proto){
				//这里会侵染原生console
				//如果配置表里存在的方法原生console没有，这里会补空方法
				!console[k] && (console[k] = EFN);
				proto[k] = consoleFactory(k);
			}
		} else { //连console都不带的老旧浏览器
			//这里先侵染 window 了，也不洁癖了，反正是老破浏览器
			//就按最江湖的方式整好了
			//由于module require async的异步性，一开始的一些log可以记在console-plus自己的存储里
			//但是在viewport来之前，就无法对接到展现了，视觉上讲，是一种丢失
			//就这样忍忍吧
			_wnd.console = {};
			for(var k in proto){
				console[k] = EFN;
				LOG_MAP[k] && (proto[k] = consoleFactory(k));
			}

			require.async('./plugins/viewport', function(vp){
					vp.bootstrap(LOG_MAP);
				});
		}

		proto.config = function(opts){
			opts = opts || {};
			opts.productName && (logEntry[0] = opts.productName);
			opts.reportUrl && (reportUrl = opts.reportUrl);

			//TODO
		};

		proto.getLogEntriesText = function(filter){
			var r
			;
			r = logStorage[filter] || logEntries;
			return r.join('\r\n');
		};

		proto.report = function(rurl, filter){
			require.async('./plugins/report', function(rpt){
					rpt.bootstrap({
						'reportUrl':		rurl || reportUrl
						, 'logLevelFilter':	filter
						, 'logStorage':		logStorage
						, 'logEntries':		logEntries
						, 'referConsolePlus':	proto
					});
				});
		};

		return proto;
	});

