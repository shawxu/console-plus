requirejs.config({
  baseUrl: "assets/js",
  paths: {
    domReady: "https://s3.shawxu.net/js/lib/requirejs/plugins/domReady.2.0.1",
    consolePlus: "../../../src/console-plus" //直接引用src文件
  }
});


require([/*'domReady', */'consolePlus'], (/*domReady, */_cp) => {
  //domReady(() => {
    //This function is called once the DOM is ready.
    //It will be safe to query the DOM and manipulate
    //DOM nodes in this function.
    _cp.config({
      silent: false //让console-plus能把log打到控制台,其实不用写也可,默认就是flase
      , productName: 'cpTest'
    });
    console.info("info start", 60);
    console.debug("debug hahaha", 1024);
    _cp.inject();
    console.error("error", "lalala", 123);
    console.warn("warn wowowo", 456);
    console.log("log papapa", 777);
    console.info("info xxxxx", 8888);
    console.debug("debug yyyyy", 999999);

    setTimeout(() => {
      document.querySelectorAll("#txt_out")[0].textContent = _cp.get();
    }, 1000);

    _cp.report({
      componentUrl: "../../../src/components/report-xhrlv2",
      //componentUrl: "../../../src/components/report",
      //reportUrl: "https://shawxu.cn:3000/stat"
    });
  //});
});

