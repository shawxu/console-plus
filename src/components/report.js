
('function' == typeof define) &&
    define(function(require, exports, module){
        var DELAY = 1000
        , dataMap = {}
        , consolePlus = {}
        , reportUrl = 'http://i.qq.com/' //随便写个默认值...
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

        function response(evt, opts){
            evt = evt || _wnd.event;
            var sf = this
            ;

            if(isIe){
                if(sf.readyState != 'complete') return;
            } else {
                sf.onload = sf.onerror = null;
            }

            consolePlus.info && consolePlus.info('console-plus report posted');
            opts.clear && consolePlus.clear && consolePlus.clear();

            sf.preSend = null;
            setTimeout(function(){
                    sf.parentNode.removeChild(sf);
                }, DELAY);
        }


        function send(opts){
            var sf = _doc.createElement('iframe')
            , dStr = (_doc.domain && _doc.domain != 'localhost') ? ('document.domain="' + _doc.domain +  '";') : ''
            , sdHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8" /><meta http-equiv="content-type" content="text/html; charset=UTF-8" /><title>postSender</title><script type="text/javascript">document.charset="utf-8";' + dStr + '<\/script></head><body><form method="post" accept-charset="utf-8" id="__cp_post_sender" enctype="application/x-www-form-urlencoded;charset=utf-8" action="javascript:;"></form><script type="text/javascript">if(window.frameElement&&window.frameElement.preSend){window.frameElement.preSend(document.getElementById("__cp_post_sender"),document);}<\/script></body></html>'
            , sdDoc
            , evtHandler
            ;

            sf.style.cssText = 'width:1px;height:0;display:none;';
            _doc.body.appendChild(sf);

            sf.src = 'about:blank';
            sf.preSend = preSend;

            evtHandler = (function(op){
                    return function(ev){
                        response.call(sf, ev, op);
                    };
                })(opts);

            isIe ? 
                (sf.onreadystatechange = evtHandler)
                    :
                (sf.onload = sf.onerror = evtHandler)
            ;

            if(isIe){
                if(location.hostname && location.hostname === _doc.domain) _doc.domain = location.hostname; //fix form sender bug for IE
                sf.sdHtml = sdHtml;
                sf.src = 'javascript:document.open();' + dStr + 'var sdHtml=frameElement.sdHtml;document.write(sdHtml);document.close();';

            //    opts.clear && consolePlus.clear && consolePlus.clear();
            } else {
                try{
                    sdDoc = sf.contentDocument || sf.contentWindow.document;
                    sdDoc.open();
                    sdDoc.write(sdHtml);
                    sdDoc.close();

                //    opts.clear && consolePlus.clear && consolePlus.clear();
                }catch(ign){}
            }

        }

        exports.bootstrap = function(opts){
                opts = opts || {};
                opts.logStorage = opts.logStorage || {};
                opts.logEntries = opts.logEntries || [];

                var t
                , buff = []
                ;

                buff.push(navigator.userAgent);

                if(_wnd.performance && (t = _wnd.performance.timing)){
                    for(var k in t){
                        buff.push(k + '\t\t\t' + t[k]);
                    }
                }

                t = opts.logStorage[opts.filter] || opts.logEntries;
                buff = buff.concat(t);

                reportUrl = opts.reportUrl || reportUrl;

                dataMap = { log: buff.join('\r\n') };

                if(t = opts.extParams){
                    for(var k in t){
                        if('log' === k.toLowerCase()) continue;
                        dataMap[k] = t[k];
                    }
                }

                consolePlus = opts.refer || consolePlus;
                
                send(opts);
            };
    });

