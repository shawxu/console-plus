('function' == typeof define) &&
	define(function(require, exports, module){
		var dout
		;

		(dout = document.getElementById('cpvp_out')) && (dout.innerHTML = 'in module define -- viewport');

		return {};
	});

