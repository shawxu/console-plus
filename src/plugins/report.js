('function' == typeof define) &&
	define(function(require, exports, module){
		var APJ = Array.prototype.join
		, dataMap = {}
		, reportUrl = 'http://i.qq.com/'
		, _wnd = window
		, _doc = document
		, isIe = !!(_wnd.ActiveXObject || _wnd.msIsStaticHTML)
		;

		function preSend(fm, doc){
			var t
			, df = doc.createDocumentFragment()
			;
			
			if(fm && fm.method){
				for(var k in dataMap){
					t = doc.createElement('input');
					t.type = 'hidden';
					df.appendChild(t);
					t.name = k;
					t.value = dataMap[k];
				}
			}

			fm.appendChild(df);
			fm.action = reportUrl;
			fm.submit();
		}


		function send(){
			var sf = _doc.createElement('iframe')
			, sdHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8" /><meta http-equiv="content-type" content="text/html; charset=UTF-8" /><title>postSender</title><script type="text/javascript">document.charset="utf-8";' + ((_doc.domain && _doc.domain != 'localhost') ? ('document.domain="' + _doc.domain +  '";') : '') + '<\/script></head><body><form method="post" accept-charset="utf-8" id="__cp_post_sender" enctype="application/x-www-form-urlencoded;charset=utf-8" action="javascript:;"></form><script type="text/javascript">if(window.frameElement&&window.frameElement.preSend){window.frameElement.preSend(document.getElementById("__cp_post_sender"),document);}<\/script></body></html>'
			, sdDoc
			;

			sf.style.cssText = 'width:1px;height:0;display:none;';
			_doc.body.appendChild(sf);

			sf.src = 'about:blank';
			sf.preSend = preSend;


			if(isIe){
				sf.sdHtml = sdHtml;
				sf.src = 'javascript:document.open();' + ((_doc.domain && _doc.domain != 'localhost') ? ('document.domain="' + _doc.domain +  '";') : '') + 'var sdHtml=frameElement.sdHtml;document.write(sdHtml);document.close();';
			} else {
				try{
					sdDoc = sf.contentDocument || sf.contentWindow.document;
					sdDoc.open();
					sdDoc.write(sdHtml);
					sdDoc.close();
				}catch(ign){}
			}

		}

		exports.bootstrap = function(rUrl, logText){
				reportUrl = rUrl || reportUrl;
				dataMap = { log: logText } || dataMap;
				
				send();
			};
	});

