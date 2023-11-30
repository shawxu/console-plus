requirejs.config({
  baseUrl: "../src",
  paths: {
    //domReady: "https://s3.shawxu.net/js/lib/requirejs/plugins/domReady.2.0.1",
    consolePlus: "./console-plus" //直接引用src文件
  }
});


require([/*'domReady', */'consolePlus'], (/*domReady, */_cp) => {
  //domReady(() => {
    _cp.config({
      silent: false //让console-plus能把log打到控制台,其实不用写也可,默认就是flase
      , productName: 'cpTest'
    });
    _cp.info("info start", 60);
    _cp.debug("debug hahaha", 1024);
    _cp.inject();
    console.error("error", "lalala", 123);
    console.warn("warn wowowo", 456);
    console.log("log papapa", 777);
    console.info("info xxxxx", 8888);
    console.debug("debug yyyyy", 999999);

    setTimeout(() => {
      document.querySelector("#txt_out").textContent = _cp.get();
    }, 2000);

    _cp.report({
      componentUrl: "./components/reportr"
    });
  //});
});

