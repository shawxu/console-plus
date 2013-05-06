console-plus
============

* 一个能够将console中的log/warn/debug/info/error接口所记录的信息全部记录到全局队列的小工具，便于在用户有问题的时候整体发回，进行定位。
* 也对接浏览器本身console的同名方法，低端浏览器无console的情况，也可模拟展示
* 可选择性直接劫持window.console或是导入到其他namespace
* 依赖开发期约定，在编码过程中多使用
* 依赖[Sea.js](https://github.com/seajs/seajs) 管理的CMD范式
