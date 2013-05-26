define(function(retuire, exports, module){
	function response(oData){
		var t = document.getElementById('txt_out')
		, buff = []
		;

		if(oData && ('object' === typeof oData)){
			if('[object Event]' === oData.toString()){
				QZONE.console.error('error load JSONP, script onerror');
				t && (t.innerHTML = buff.join('Error!'));
			} else {
				QZONE.console.info('error load JSONP succeed');
				for(var k in oData){
					buff.push(k + ' : ' + oData[k]);
					QZONE.console.log('[', k, '] added to out stream');
				}
				t && (t.innerHTML = buff.join('<br />'));
				QZONE.console.info('showout succeed');
			}
		} else {
			QZONE.console.warn('error load JSONP, unknow error');
			t && (t.innerHTML = buff.join('Error!'));
		}
	}

	function start2ShowWeather(){
		QZONE.console.log('start to show weather');

		window._Callback = response;
		var hd
		, t
		;
		
		if(hd = document.head || (t = document.getElementsByTagName('head'), (t && t.length ? t[0] : null))){
			QZONE.console.log('got tag', hd.tagName);
			t = document.createElement('script');
			t.type = 'text/javascript';
			t.charset = 'utf-8';
			t.onerror = response;
			hd.appendChild(t);
			t.src = 'http://r.qzone.qq.com/cgi-bin/user/qzone_msgtunnel_geoinfo';
		} else {
			QZONE.console.error('can not find HEAD Element');
		}

	}

	exports.bootstrap = function(){
		start2ShowWeather();
	};
});