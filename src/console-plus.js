('function' == typeof define) &&
	define(function(require, exports, module){
		var EFN = function(){}
		, APJ = Array.prototype.join
		, LOG_MAP = {
			debug:			'debug'
			, error:		'error'
			, info:			'info'
			, log:			'log'
			, warn:			'warn'
		}
		, LT_ABS_TIME = 2
		, LT_PERFORMANCE_TIME = 3
		, proto = {
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
			'' //product name
			, '' //logLevel
			, '' //absTime
			, '' //performanceNow
			, '' //logMessage
		]
		, logStorage = {
			debug:			[]
			, error:		[]
			, info:			[]
			, log:			[]
			, warn:			[]				
		}
		;
		
		latencyType = (window.performance && performance.now) ?
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
					Function.prototype.call.call(console[n], console, logEntry[4]);
					//console[n].call(console, logEntry[4]); //IE9不行，console.log之类的不是标准的Function类型，IE10,Chrome,FF之类都可以
				};
			} else {
				return function(){
					console[n].apply(console, arguments);
				};
			}
		}
		
		if(('object' == typeof window) && window.console){
			for(var k in proto){
				console[k] && (proto[k] = consoleFactory(k));
			}
		} else {
			window.console = {}; //这里侵染 window 了...
			for(var k in proto){
				console[k] = EFN;
				LOG_MAP[k] && (proto[k] = consoleFactory(k));
			}
		}

		proto.getLogEntriesText = function(filter){
			var r
			;
			r = logStorage[filter] || logEntries;
			return r.join('\n');
		};

		return proto;
	});

