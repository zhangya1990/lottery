
# lottery
年会抽奖软件


>开发目的

公司年会抽奖工具

> 源码使用手册

```sh
git clone http://github.com/zhangya1990/lottery.git
cd lottery

#安装依赖包
npm install 

#启动项目
npm start
#或者打包windows或者mac包
npm run package

#如果要打包其他版本自己修改参数 --platform=win32 

electron-packager ./src/ lottery  --out ./dist --electronVersion=4.0.0 --platform=darwin,win32 --overwrite --icon=./src/assets/images/app

```

> 打包后如何使用

- 配置文件在打包的目录 lottery-win32-x64\resources\config.json 
- 用户文件在打包的目录 lottery-win32-x64\resources\data.json 
- 支持通过Excel导入用户数据 前三列分别为用户id，用户名，用户性别，可自行扩展
- 运行 

> 关于配置数据

- 在lottery-win32-x64\resources\config.json  title 抽奖结果页标题文案
- 在lottery-win32-x64\resources\data.json  users 用户数据  prizes 奖项数据

