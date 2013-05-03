('function' == typeof define) &&
	define(function(require, exports, module){
		var EFN = function(){}
			, APJ = Array.prototype.join
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
			, LOG_MAP = {
				debug:			'debug'
				, error:		'error'
				, info:			'info'
				, log:			'log'
				, warn:			'warn'
			}
			, latencyType = 2 //magic number to resolve
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
			;
		
		latencyType = (window.performance && performance.now) ?
			(latencyMethod = function(){ return performance.now(); }, 3)
				:
			(Date.now ?
				(latencyMethod = function(){ return Date.now(); }, 2)
					:
				2); //magic numbers to resolve

		function consoleFactory(n){
			if(LOG_MAP[n]){
				return function(){
					logEntry[1] = n;
					logEntry[latencyType] = latencyMethod();
					logEntry[4] = APJ.call(arguments, ' ');

					logEntries.push(logEntry.join('\t'));
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

		proto.getLogEntriesText = function(){
			return logEntries.join('\n');
		};

		return proto;
	});

