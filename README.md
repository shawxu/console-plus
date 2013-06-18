console-plus
============
增强型console工具，对接window.console，将console log记录收集，并上报

Note
----
依赖 [Sea.js](https://github.com/seajs/seajs) 或 [RequireJS](https://github.com/jrburke/requirejs)

What's it for?
--------------
* 能够将console中的log/warn/debug/info/error接口所记录的信息全部记录到全局队列的小工具，便于在用户有问题的时候整体发回，进行问题定位
* 同时对接浏览器本身console的同名方法，低端浏览器无console的情况，也可模拟展示一个简单的console视图
* 可选择性直接劫持window.console或是导入到其他namespace

Quick Example
-------------
```javascript
seajs.use(['../console-plus', './main'], function(cp, main){
	!window.QZONE && (window.QZONE = {}, QZONE.console = cp);
	QZONE.console.info('console plus loaded, bind to "QZONE.console"');

	//Your code...
	main.bootstrap();
});
```
样例源代码见[这里](https://github.com/shawxu/console-plus/tree/master/example)


Log Format
----------
下面是一条普通的`console-plus log entry`记录文本(来自于上文的example的一条结果)
> cpExample	info	1370246230837		console plus loaded, bind to "QZONE.console"

其中
* `cpExample` 是 product name 字段
* `info` 是 log level 字段
* `1370246230837` 是 absolute time 字段
* `console plus loaded, bind to "QZONE.console"` 是 log message 字段

字段之间，用'\t'(一个或者两个)来分割

对于支持`performance.now()`的浏览器，单条log是这样的
> cpExample	info		3106.000000028871	console plus loaded, bind to "QZONE.console"

可见，此时 absolute time 字段将被 `3106.000000028871` 这样的 performance now time 字段代替

事实上，核心字段定义数据结构是如下的样子
```javascript
logEntry = [
	''   //product name
	, '' //log level
	, '' //absolute time
	, '' //performance now time
	, '' //log message
];
```

Interfaces
----------

### log ###

记录一条log信息

```javascript
//console-plus exports to QZONE.console
QZONE.console.log('response OK', 'code 0', 'msg: succeed!');
```
console-plus的`log()`接口会在记录本条log到总体队列的同时，再调用浏览器原生`console.log()`

IE9 的运行效果图

![IE9运行效果](http://y.photo.qq.com/img?s=4oGLUb7TA&l=y.jpg)



### info / debug / warn / error ###

记录不同log等级的信息

```javascript
//console-plus exports to QZONE.console
QZONE.console.info('enter function "main"');
QZONE.console.debug('tag 1', 'time 2');
QZONE.console.warn('param "opts" is undefined');
QZONE.console.error('error in function', this.toString());
```
同`log()`接口，`info()` `debug()` `warn()` `error()` 都会写入log队列，并调用原生`console`的相应方法，只是体现不同的log level定义

IE9 的运行效果图

![IE9运行效果](http://y.photo.qq.com/img?s=o7gEP6QIS&l=y.jpg)



### config ###

##### exports.config(opts) #####

全局设置接口

`@param {object} [opts]`<br />
`@param {string} [opts.productName = 'qzone']`<br />
`@param {string} [opts.reportUrl = 'http://i.qq.com/']`

```javascript
//console-plus exports to cp
cp.config({
	productName: 'cpExample'
	, reportUrl: 'http://w.qzone.qq.com/cgi-bin/user/report'
});
```


### get ###

获取存储在前端log队列中的信息

##### exports.get(filter) #####
`@param {string} [filter]`  log level过滤器，值域'log' | 'info' | 'debug' | 'warn' | 'error'

```javascript
//console-plus exports to QZONE.console
QZONE.console.config({
	productName: 'cpExample'	
});

QZONE.console.log('response OK', 'code 0', 'msg: succeed!');
QZONE.console.info('enter function "main"');
QZONE.console.debug('tag 1', 'time 2');
QZONE.console.warn('param "opts" is undefined');
QZONE.console.error('error in function', 'showOut()');

QZONE.console.get();

//return value: (string)
//cpExample	log			28894.801999995252	response OK code 0 msg: succeed!
//cpExample	info		28895.2169999975	enter function "main"
//cpExample	debug		28895.513999996183	tag 1 time 2
//cpExample	warn		28895.746999995026	param "opts" is undefined
//cpExample	error		28895.951999998942	error in function showOut()

QZONE.console.get('warn');

//return value: (string)
//cpExample	warn		28895.746999995026	param "opts" is undefined

```



### report ###

##### exports.report(opts) #####

上报错误到指定服务

`@param {object} [opts]`<br />
`@param {string} [opts.filter]`<br />
`@param {string} [opts.reportUrl = 'http://i.qq.com/']`<br />
`@param {object} [opts.params = {}]`


```javascript
//console-plus exports to QZONE.console

QZONE.console.report({
	params: {
		uid: '1234567'
		, label: 'xx\'s log'
	}
	, filter: 'error' 
});

//report HTTP POST request body:
//log=......log...text......&uid=1234567&label=xx%27s+log
```



