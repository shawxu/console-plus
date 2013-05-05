('function' == typeof define) &&
	define(function(require, exports, module){
		var DOMID_PANEL = '___cp_console_viewport_panel'
		, proto
		, _wnd = window
		, _doc = document
		;

		//(dout = document.getElementById('cpvp_out')) && (dout.innerHTML = 'in module define -- viewport');
		//window.console.log = function(){ alert('I\'m console-plus!'); };

		function createViewportWindow(){
			var d
			, cb
			;

			if(d = _doc.getElementById(DOMID_PANEL)){
			} else {
				d = _doc.createElement('pre');
				d.style.cssText = ([
					'position:absolute;top:3px;left:3px;'
					, 'border:solid 1px gray;'
					, 'width:400px;height:200px;margin:0;'
					, 'filter:progid:DXImageTransform.Microsoft.Alpha(opacity=50);'
					, '-ms-filter:"progid:DXImageTransform.Microsoft.Alpha(opacity=50)";'
					, 'background-color:rgba(255,255,255,0.5)'
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
			}
		}

		exports.bootstrap = function(){
				createViewportWindow();
			};
	});

