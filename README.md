console-plus
============
增强型console工具，对接window.console，将console log记录收集，并上报

Note
----
依赖[Sea.js](https://github.com/seajs/seajs)

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
* cpExample 是`product name`字段
* info 是`log level`字段
* 1370246230837 是`absolute time`字段
* console plus loaded, bind to "QZONE.console" 是`log message`字段

字段之间，用'\t'(一个或者两个)来分割

对于支持`performance.now()`的浏览器，单条log是这样的
> cpExample	info		3106.000000028871	console plus loaded, bind to "QZONE.console"

可见，此时`absolute time`字段将被 3106.000000028871 这样的`performance now time`字段代替

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





