define(() => {
  'use strict';

  let proto = undefined, 
    clearThen = true;

  function requestURL(url, 
    method = 'GET', 
    succCallback = () => {}, 
    errorCallback = (err) => {}, //errorCallback
    {
      timeOut = 3000, //default timeout 3s = 3000ms
      requestBody = {} //for POST request, request Body, data to upload
    } = {}){
  
    let ruPromise = new Promise((rslv, rjct) => {
      let xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
  
      xhr.timeout = timeOut;
  
      xhr.onload = (pe) => {
        if(xhr.readyState === 4){
          if(xhr.status === 200){
            proto && ('function' === typeof proto.clear) && proto.info('will call resolve');
            rslv(xhr.responseText);
            clearThen && proto && ('function' === typeof proto.clear) && proto.clear();
          }
        }
      };
      xhr.onerror = (networkError) => {
        let m = `${networkError} error`;
        //console.log(m);
        rjct(new Error(m));
      };
      xhr.ontimeout = (timeOutError) => {
        let m = `${timeOutError} timeout`;
        //console.log(m);
        rjct(new Error(m));
      };
  
      xhr.send(requestBody);
    });
  
    ruPromise.then(succCallback).catch(errorCallback);
  }

  function send(opts){
    clearThen = opts.clear;
    requestURL(
      opts.reportUrl,
      'POST',
      () => {},
      () => {},
      {
        requestBody: opts.dataMap
      }
    );
  }


  return {
    bootstrap({
      logStorage = {},
      logEntries = [],
      filter,
      reportUrl = 'https://shawxu.cn:3001/',
      refer,
      extParams,
      clear = true } = {}){
        let t, buff = [], dataMap = new FormData();

        dataMap.append('timing', JSON.stringify(performance.timing.toJSON()));

        t = logStorage[filter] || logEntries;
        buff = buff.concat(t);

        dataMap.append('log', buff.join('\n'));

        if(t = extParams){
            for(let k in t){
                if('log' === k.toLowerCase()) continue;
                dataMap.append(k, t[k]);
            }
        }
        
        send({ reportUrl, logStorage, logEntries, extParams, refer, dataMap, clear });
    }
  }
});

