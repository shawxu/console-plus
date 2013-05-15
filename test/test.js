define(function(retuire, exports, module){
	function response(oData){
		QZONE.console.log(oData);
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
			hd.appendChild(t);
			t.src = 'http://r.qzone.qq.com/cgi-bin/user/qzone_msgtunnel_geoinfo';
		}

	}

	exports.bootstrap = function(){
		start2ShowWeather();
	};
});