requirejs.config({
  baseUrl: "assets/js",
  paths: {
    domReady: "https://s3.shawxu.net/js/lib/requirejs/plugins/domReady.2.0.1",
    consolePlus: "../../../src/console-plus" //直接引用src文件
  }
});


require(['domReady', 'consolePlus'], (domReady, _cp) => {
  domReady(() => {
    //This function is called once the DOM is ready.
    //It will be safe to query the DOM and manipulate
    //DOM nodes in this function.
    _cp.config({
      writeConsolePanel: true //让console-plus能把log打到控制台
      , productName: 'cpTest'
    });
    _cp.info("info start");
    _cp.debug("debug hahaha");
    _cp.error("error lalala");
    _cp.warn("warn wowowo");
    _cp.log("log papapa");

    document.querySelectorAll("#txt_out")[0].textContent = _cp.get();

    _cp.report({
      componentUrl: "../../../src/components/report-xhrlv2",
      //componentUrl: "../../../src/components/report",
      reportUrl: "https://shawxu.cn:3000/stat"
    });
  });
});

