define(function(require, exports, module){
  'use strict';

  let dataMap = {}
  , consolePlus = {}
  , reportUrl = 'https://shawxu.cn:3001/' //随便写个默认值...
  ;

  function requestURL(url, 
    method = 'GET', 
    succCallback = () => {}, 
    errorCallback = (err) => { console.log('XHR default error callback, exception is:', err) }, //errorCallback
    {
      timeOut = 3000, //default timeout 3s = 3000ms
      requestBody = {} //for POST request, request Body, data to upload
  } = {}){
  
    let ruPromise = new Promise((rslv, rjct) => {
      let xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
  
      xhr.timeout = timeOut;
  
      xhr.onload = (pe) => {
        console.log(xhr.readyState, xhr.status, xhr.statusText, xhr.responseType, xhr.responseText);
        if(xhr.readyState === 4){
          if(xhr.status === 200){
            console.log('will call resolve');
            rslv(xhr.responseText);
          }
  
        }
      };
      xhr.onerror = (networkError) => {
        let m = `${networkError} error`;
        console.log(m);
        rjct(new Error(m));
      };
      xhr.ontimeout = (timeOutError) => {
        let m = `${timeOutError} error`;
        console.log(m);
        rjct(new Error(m));
      };
  
      xhr.send(requestBody);
    });
  
    ruPromise.then(succCallback).catch(errorCallback);
  }

  function send(opts){
    requestURL(
      reportUrl,
      'POST',
      () => {},
      () => {},
      {
        requestBody: dataMap
      }
    );
  }


  exports.bootstrap = (opts = {}) => {
      opts.logStorage = opts.logStorage || {};
      opts.logEntries = opts.logEntries || [];

      let t = performance.timing
      , buff = []
      ;

      if('function' === typeof t.toJSON){
          buff.push(JSON.stringify(t.toJSON()));
      } else {
          for(let k in t){
              ('number' === typeof t[k]) && buff.push(k + '\t\t\t' + t[k]);
          }
      }

      t = opts.logStorage[opts.filter] || opts.logEntries;
      buff = buff.concat(t);

      reportUrl = opts.reportUrl || reportUrl;

      dataMap = { log: buff.join('\r\n') };

      if(t = opts.extParams){
          for(let k in t){
              if('log' === k.toLowerCase()) continue;
              dataMap[k] = t[k];
          }
      }

      consolePlus = opts.refer || consolePlus;
      
      send(opts);
  };
});

