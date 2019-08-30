'use strict';

requirejs.config({
  baseUrl: "assets/js",
  paths: {
    domReady: "./lib/requireJs/domReady",
    consolePlus: "../../../src/console-plus"
  }
});


require(['domReady', 'consolePlus'], (domReady, _cp) => {
  domReady(() => {
    //This function is called once the DOM is ready.
    //It will be safe to query the DOM and manipulate
    //DOM nodes in this function.
    _cp.config({
      writeConsolePanel: true //让console-plus能把log打到控制台
    });
    _cp.info("start");

  });
});

