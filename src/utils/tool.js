const path = require('path');
const fs = require('fs');

function getNow() {
  let Y, M, D, h, m, s, date
  const format = num => num.toString().length > 1 ? num : `0${num}`
  date = new Date()
  Y = date.getFullYear()
  M = format(date.getMonth() + 1)
  D = format(date.getDate())
  h = format(date.getHours())
  m = format(date.getMinutes())
  s = format(date.getSeconds())
  return `${Y}-${M}-${D} ${h}:${m}:${s}`
}

function errorLog(e) {
  console.log(e);
  showUncaughtError(e);
}

function showUncaughtError(err) {
  if(!err){
      return
  }
  let errorLogPath = path.join(__dirname, '../error.log');
  let time = getNow();
  let message,stack;
  if(typeof err === 'string'){
      fs.appendFileSync(errorLogPath, '\r\n', 'utf8');
      message = err
  }else if(typeof err === 'object' && err !== null){
      fs.appendFileSync(errorLogPath, '\r\n', 'utf8');
      message = err.message;
      stack = err.stack;
  }else{
      try{
          fs.appendFileSync(errorLogPath, '\r\n', 'utf8');
          message = JSON.stringify(err)
      }catch(e){
          fs.appendFileSync(errorLogPath, '\r\n', 'utf8');
          message = err.toString();
      }
  }
  let errorInfo = `Date:${time}\r\nErrorMessage:${message||''}\r\nErrorStack:${stack||''}\r\n`;
  fs.appendFileSync(errorLogPath, errorInfo, 'utf8');
}

exports.showUncaughtError = showUncaughtError;
exports.errorLog = errorLog;