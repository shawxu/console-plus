('function' == typeof define) &&
	define(function(require, exports, module){
		var DOMID_PANEL = '___cp_console_viewport_panel'
		, DOMID_ANCHOR = '___cp_console_viewport_anchor'
		, APJ = Array.prototype.join
		, LOG_MAP = {
			debug:			'<d> '
			, error:		'<x> '
			, info:			'<i> '
			, log:			'<o> '
			, warn:			'<!> '
		}
		, _wnd = window
		, _doc = document
		, refViewportPanelDomElem
		;

		function hideViewportWindow(evt){
			var d = _doc.getElementById(DOMID_PANEL)
			, a = _doc.getElementById(DOMID_ANCHOR)
			;

			d && (d.style.visibility = 'hidden');
			a && (a.style.visibility = 'visible');

			preventDefault(evt);
		}

		function showViewportWindow(evt){
			var d = _doc.getElementById(DOMID_PANEL)
			, a = _doc.getElementById(DOMID_ANCHOR)
			;

			d && (d.style.visibility = 'visible');
			a && (a.style.visibility = 'hidden');

			preventDefault(evt);
		}

		function preventDefault(evt){
			evt ? (evt.preventDefault ? evt.preventDefault() : (evt.returnValue = false)) : 0;
		}

		function addEvent(elem, type, fn){
			if(elem.addEventListener){
				elem.addEventListener(type, fn, false);
			} else if(cb.attachEvent){
				elem.attachEvent('on' + type, fn);
			}
		}

		function createViewportWindow(){
			var d
			, a
			, cb
			;

			if(a = _doc.getElementById(DOMID_ANCHOR)){
				//存在就不干了
			} else {
				a = _doc.createElement('a');
				a.style.cssText = ([
					'position:absolute;top:3px;right:3px;'
					, 'border:solid 1px gray;'
					, 'width:50px;height:16px;'
					, 'font-family:verdana;text-decoration:none;font-size:12px;'
					]).join('');
				a.id = DOMID_ANCHOR;
				a.innerHTML = 'Console';
				a.href = 'javascript:;';
				a.title = 'Click to open console panel';
				_doc.body.appendChild(a);
				addEvent(a, 'click', showViewportWindow);
			}

			if(d = _doc.getElementById(DOMID_PANEL)){
				//存在就不干了
			} else {
				d = _doc.createElement('pre');
				d.style.cssText = ([
					'position:absolute;top:3px;right:3px;'
					, 'border:solid 1px gray;'
					, 'width:720px;height:300px;margin:0;'
					, 'filter:progid:DXImageTransform.Microsoft.Alpha(opacity=50);'
					, '-ms-filter:"progid:DXImageTransform.Microsoft.Alpha(opacity=50)";'
					, 'background-color:rgba(255,255,255,0.5);'
					, 'visibility:hidden;'
					, 'overflow:scroll;'
					]).join('');
				d.id = DOMID_PANEL;
				_doc.body.appendChild(d);

				cb = _doc.createElement('a');
				cb.style.cssText = ([
					'position:absolute;top:0;right:0;'
					, 'width:15px;height:15px;'
					, 'font-family:verdana;text-decoration:none;'
					]).join('');
				cb.innerHTML = '×';
				cb.href = 'javascript:;';
				cb.title = 'Click to close';
				d.appendChild(cb);
				addEvent(cb, 'click', hideViewportWindow);
			}

			refViewportPanelDomElem = d;
		}

		function createConsoleLogMethods(logConsoleMethodMap){
			logConsoleMethodMap = logConsoleMethodMap || LOG_MAP;
			if('object' == typeof logConsoleMethodMap){
				for(var k in logConsoleMethodMap){
					console[k] = consoleFactory(k);
				}
			}
		}

		function consoleFactory(n){
			return function(){
				var t
				;
				t = _doc.createTextNode(LOG_MAP[n] + APJ.call(arguments, ' ') + '\n');
				refViewportPanelDomElem.appendChild(t);
			};
		}

		exports.bootstrap = function(logConsoleMethodMap){
				createViewportWindow();
				createConsoleLogMethods(logConsoleMethodMap);
			};
	});

