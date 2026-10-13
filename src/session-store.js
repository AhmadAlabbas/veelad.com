import session from 'express-session';
export class MySQLSessionStore extends session.Store {
 constructor(db) {
  super();this.db=db;
  this.timer=setInterval(()=>db.q('DELETE FROM sessions WHERE expires<?',[Math.floor(Date.now()/1000)]).catch(()=>this.emit('error',new Error('Session cleanup failed'))),15*60*1000);this.timer.unref();
 }
 get(id,callback) {
  this.db.one('SELECT data FROM sessions WHERE session_id=? AND expires>?',[id,Math.floor(Date.now()/1000)]).then(row=>callback(null,row?JSON.parse(row.data):null)).catch(callback);
 }
 set(id,value,callback=()=>{}) {
  const expires=Math.floor(new Date(value.cookie.expires||Date.now()+12*3600000).getTime()/1000),data=JSON.stringify(value);
  this.db.q('INSERT INTO sessions VALUES (?,?,?) ON DUPLICATE KEY UPDATE expires=?,data=?',[id,expires,data,expires,data]).then(()=>callback(null)).catch(callback);
 }
 destroy(id,callback=()=>{}) {this.db.q('DELETE FROM sessions WHERE session_id=?',[id]).then(()=>callback(null)).catch(callback);}
 touch(id,value,callback=()=>{}) {const expires=Math.floor(new Date(value.cookie.expires||Date.now()+12*3600000).getTime()/1000);this.db.q('UPDATE sessions SET expires=? WHERE session_id=?',[expires,id]).then(()=>callback(null)).catch(callback);}
 async close() {clearInterval(this.timer);}
}
