@echo off
.\node_modules\.bin\uglifyjs.cmd .\src\console-plus.js -c -m --verbose -o .\dist\console-plus.min.js
.\node_modules\.bin\uglifyjs.cmd .\src\components\reportr.js -c -m --verbose -o .\dist\components\reportr.js