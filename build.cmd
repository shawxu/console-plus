@echo off
npx uglifyjs .\src\console-plus.js -c -m --verbose -o .\dist\console-plus.min.js
npx uglifyjs .\src\components\reportr.js -c -m --verbose -o .\dist\components\reportr.js