const path = require('path');
const fs = require('fs');
const {app,ipcMain,BrowserWindow,globalShortcut} = require('electron');
const {errorLog} = require('./utils/tool');
const isDev = process.env.ELECTRON_ENV == 'development'


class App{
  constructor(){
    this.init();
  }
  init(){
    app.on('ready',()=>{
      this.initConfig().then(()=>{
        this.initWindow();
      });
    })
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })
    
    app.on('activate', () => {
      if (!this.mainWindow) {
        this.initWindow()
      }
    })
    app.commandLine.appendSwitch('--autoplay-policy','no-user-gesture-required')
  }

  initConfig(){
    let config = Object.create(null);
    config.appDataPath = app.getPath('appData');
    config.appName = app.getName();
    config.userData = app.getPath('userData');

    let docConfig = {title:'微博动漫2019年会'}
    const configPath = path.join(__dirname,'../config.json');

    return new Promise((res,rej)=>{
      fs.access(configPath,fs.constants.F_OK,err=>{
        let raw;
        if(err){
          fs.writeFileSync(configPath,JSON.stringify(docConfig),'utf8')
        }else{
          try{
            raw = fs.readFileSync(configPath,'utf8');
            docConfig = JSON.parse(raw);
          }catch(e){
            fs.writeFileSync(configPath,JSON.stringify(docConfig),'utf8')
          }
        }
        config = Object.assign({},config,docConfig)
        global.config = config;
        res()
      })
    })
  }

  initWindow(){
    let mainWindow = this.mainWindow = new BrowserWindow({
      title:'lottery',
      frame:false,
      show:false,
      resizable: false,
      fullscreen:true,
      autoHideMenuBar:true,
      titleBarStyle:'hidden'
    });
    mainWindow.loadURL('file://' + path.join(__dirname,'lottery','index.html'));
    mainWindow.webContents.on('dom-ready',()=>{
      mainWindow.show();
    });
    mainWindow.on('closed',()=>{
        mainWindow = null;
    });
    // mainWindow.webContents.openDevTools({mode : 'detach'});

    mainWindow.setAutoHideMenuBar(true)
    mainWindow.on('closed', () => {
      mainWindow = null
    })
  
    globalShortcut.unregisterAll();
  
    //关闭/打开背景音乐
    globalShortcut.register('alt+v',()=>{
      mainWindow.webContents.send('global-shortcut','novoice');
    });
    //退出
    globalShortcut.register('ctrl+q',()=>{
      app.quit();
    });
    //调试
    globalShortcut.register('ctrl+i',function(){
      mainWindow.webContents.openDevTools();
    });
  }
}

process.on('uncaughtException', function (err) {
  errorLog(err);
});

new App()
