<?php
declare(strict_types=1);
function fail(int $status, string $message): never { http_response_code($status); echo json_encode(['error'=>$message]); exit; }
function out(mixed $value): never {header('Content-Type: application/json');echo json_encode($value,JSON_UNESCAPED_SLASHES);exit;}
function uid(string $prefix=''): string { return $prefix.bin2hex(random_bytes(12)); }
function config(): array {static $c=null;if($c===null){if(!is_file(__DIR__.'/config.php'))fail(503,'Server setup is required. Use the included Hostinger setup guide.');$c=require __DIR__.'/config.php';}return $c;}
function db(): PDO {static $p=null;if(!$p){$c=config();$p=new PDO($c['dsn'],$c['db_user']??null,$c['db_password']??null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}return $p;}
function query(string $sql,array $args=[]): PDOStatement {$s=db()->prepare($sql);$s->execute($args);return $s;}
function one(string $sql,array $args=[]): ?array {return query($sql,$args)->fetch()?:null;}
function jsondata(string $s): array {return json_decode($s,true,512,JSON_THROW_ON_ERROR);}
function input(): array {$raw=file_get_contents('php://input');if(strlen($raw)>100000)fail(413,'Request too large.');try{$v=json_decode($raw?:'{}',true,64,JSON_THROW_ON_ERROR);}catch(Throwable){fail(400,'Invalid JSON.');}if(!is_array($v))fail(400,'Invalid request.');return $v;}
function cliptext(string $s,int $n): string {return implode('',array_slice(preg_split('//u',$s,-1,PREG_SPLIT_NO_EMPTY)?:[],0,$n));}
function textfield(array $v,string $key,int $max=200,bool $required=true): string {$s=trim((string)($v[$key]??''));if(($required&&$s==='')||strlen($s)>$max)fail(422,"Please check $key.");return $s;}
function emailfield(array $v,string $key='email'): string {$s=strtolower(textfield($v,$key,190));if(!filter_var($s,FILTER_VALIDATE_EMAIL))fail(422,'Enter a valid email address.');return $s;}
function safeuser(array $u): array {return ['id'=>$u['id'],'name'=>$u['name'],'email'=>$u['email'],'role'=>$u['role'],'status'=>$u['status'],'created_at'=>$u['created_at']];}
function me(bool $required=false): ?array {$u=isset($_SESSION['user_id'])?one('SELECT * FROM users WHERE id=?',[$_SESSION['user_id']]):null;if($u&&($u['status']!=='active'||!hash_equals((string)($_SESSION['password_stamp']??''),hash('sha256',$u['password']))))$u=null;if(!$u&&$required)fail(401,'Please sign in to continue.');return $u;}
function role(string ...$roles): array {$u=me(true);if(!in_array($u['role'],$roles,true))fail(403,'This area is restricted to your account role.');return $u;}
function csrf(): void {if(!hash_equals($_SESSION['csrf']??'',$_SERVER['HTTP_X_CSRF_TOKEN']??''))fail(403,'Your session expired. Refresh and try again.');}
function throttle(string $bucket,int $max=10): void {$key=hash('sha256',$bucket.'|'.($_SERVER['REMOTE_ADDR']??'cli').'|'.intdiv(time(),900));$row=one('SELECT hits FROM rate_limits WHERE id=?',[$key]);if($row){if((int)$row['hits']>=$max)fail(429,'Too many attempts. Please try again in 15 minutes.');query('UPDATE rate_limits SET hits=hits+1 WHERE id=?',[$key]);}else{try{query('INSERT INTO rate_limits (id,hits,expires) VALUES (?,1,?)',[$key,time()+1800]);}catch(PDOException){query('UPDATE rate_limits SET hits=hits+1 WHERE id=?',[$key]);}}query('DELETE FROM rate_limits WHERE expires<?',[time()]);}
function settings(): array {return jsondata(one('SELECT data FROM settings WHERE id=?',['store'])['data']);}
function product(array $p): array {$d=jsondata($p['data']);return array_merge($d,['id'=>$p['id'],'artist_id'=>$p['artist_id'],'status'=>$p['status'],'stock'=>(int)$p['stock']]);}
function products(bool $all=false,?string $artist=null): array {$sql='SELECT * FROM products';$where=[];$args=[];if(!$all){$where[]="status='active'";}if($artist){$where[]='artist_id=?';$args[]=$artist;}if($where)$sql.=' WHERE '.implode(' AND ',$where);return array_map('product',query($sql.' ORDER BY created_at DESC,id',$args)->fetchAll());}
function publicartists(): array {return array_map(fn($r)=>jsondata($r['data']),query('SELECT * FROM artists')->fetchAll());}
function schema(): void {
 $sql=[
 'CREATE TABLE IF NOT EXISTS users (id VARCHAR(64) PRIMARY KEY,name VARCHAR(120) NOT NULL,email VARCHAR(190) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL,role VARCHAR(20) NOT NULL,status VARCHAR(20) NOT NULL,created_at VARCHAR(40) NOT NULL)',
 'CREATE TABLE IF NOT EXISTS artists (id VARCHAR(64) PRIMARY KEY,data TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS products (id VARCHAR(64) PRIMARY KEY,artist_id VARCHAR(64) NOT NULL,status VARCHAR(20) NOT NULL,stock INTEGER NOT NULL,data TEXT NOT NULL,created_at VARCHAR(40) NOT NULL)',
 'CREATE TABLE IF NOT EXISTS orders (id VARCHAR(64) PRIMARY KEY,user_id VARCHAR(64),email VARCHAR(190) NOT NULL,status VARCHAR(30) NOT NULL,total INTEGER NOT NULL,data TEXT NOT NULL,guest_hash VARCHAR(64) NOT NULL,request_key VARCHAR(64) NOT NULL UNIQUE,created_at VARCHAR(40) NOT NULL)',
 'CREATE TABLE IF NOT EXISTS settings (id VARCHAR(64) PRIMARY KEY,data TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS messages (id VARCHAR(64) PRIMARY KEY,type VARCHAR(30) NOT NULL,email VARCHAR(190) NOT NULL,data TEXT NOT NULL,status VARCHAR(20) NOT NULL,created_at VARCHAR(40) NOT NULL)',
 'CREATE TABLE IF NOT EXISTS rate_limits (id VARCHAR(64) PRIMARY KEY,hits INTEGER NOT NULL,expires INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS uploads (id VARCHAR(64) PRIMARY KEY,user_id VARCHAR(64) NOT NULL,path VARCHAR(100) NOT NULL,mime VARCHAR(40) NOT NULL)',
 'CREATE TABLE IF NOT EXISTS customer_state (id VARCHAR(64) PRIMARY KEY,data TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS password_resets (id VARCHAR(64) PRIMARY KEY,user_id VARCHAR(64) NOT NULL,expires INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS mail_queue (id VARCHAR(64) PRIMARY KEY,email VARCHAR(190) NOT NULL,subject VARCHAR(190) NOT NULL,body TEXT NOT NULL,status VARCHAR(20) NOT NULL,attempts INTEGER NOT NULL,created_at VARCHAR(40) NOT NULL)',
 'CREATE TABLE IF NOT EXISTS audit_log (id VARCHAR(64) PRIMARY KEY,user_id VARCHAR(64) NOT NULL,action VARCHAR(100) NOT NULL,target VARCHAR(100) NOT NULL,created_at VARCHAR(40) NOT NULL)'];
 foreach($sql as $q)db()->exec($q.(db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql'?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci':''));
}
function install(string $email,string $password): void {schema();if(one('SELECT id FROM users WHERE role=?',['admin']))fail(409,'Installation already completed.');if(strlen($password)<12)fail(422,'Use at least 12 characters for the admin password.');if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail(422,'Enter a valid admin email.');db()->beginTransaction();try{$id=uid('user-');query('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[$id,'Veelad Admin',strtolower($email),password_hash($password,PASSWORD_DEFAULT),'admin','active',gmdate('c')]);$seed=jsondata(file_get_contents(__DIR__.'/seed.json'));foreach($seed['artists'] as $a)query('INSERT INTO artists VALUES (?,?)',[$a['id'],json_encode($a)]);foreach($seed['products'] as $p)query('INSERT INTO products VALUES (?,?,?,?,?,?)',[$p['id'],$p['artist_id'],'active',$p['stock'],json_encode($p),gmdate('c')]);query('INSERT INTO settings VALUES (?,?)',['store',json_encode($seed['settings'])]);db()->commit();}catch(Throwable $e){db()->rollBack();throw $e;}}
function orderview(array $o): array {return array_merge(jsondata($o['data']),['id'=>$o['id'],'status'=>$o['status'],'total'=>(int)$o['total'],'created_at'=>$o['created_at']]);}
function audit(array $u,string $action,string $target): void {query('INSERT INTO audit_log VALUES (?,?,?,?,?)',[uid(),$u['id'],$action,$target,gmdate('c')]);}
function validproduct(array $d,?array $existing=null): array {
 $title=textfield($d,'title',100);$category=textfield($d,'category',30);$cats=['T-shirts','Tote bags','Phone cases','Art prints','Mugs','Stickers','Notebooks'];if(!in_array($category,$cats,true))fail(422,'Choose a product category.');
 $price=filter_var($d['price']??null,FILTER_VALIDATE_INT);$stock=filter_var($d['stock']??50,FILTER_VALIDATE_INT);if($price===false||$price<100||$price>100000||$stock===false||$stock<0||$stock>100000)fail(422,'Check product price and stock.');
 $variants=$d['variants']??['Standard'];if(!is_array($variants)||count($variants)<1||count($variants)>12)fail(422,'Add 1–12 variants.');$variants=array_values(array_unique(array_map(fn($v)=>cliptext(trim((string)$v),50),$variants)));if(in_array('',$variants,true))fail(422,'Variant names cannot be empty.');
 $p=['title'=>$title,'category'=>$category,'price'=>$price,'stock'=>$stock,'description'=>textfield($d,'description',2000),'variants'=>$variants,'royalty_percent'=>20,'badge'=>'New','tags'=>[],'sheet'=>min(1,max(0,(int)($d['sheet']??0))),'cell'=>min(5,max(0,(int)($d['cell']??0)))];
 if(isset($d['upload_id'])&&$d['upload_id']){$u=one('SELECT * FROM uploads WHERE id=?',[$d['upload_id']]);$me=me(true);if(!$u||($u['user_id']!==$me['id']&&$me['role']!=='admin'))fail(403,'Artwork unavailable.');$p['upload_id']=$u['id'];}
 return $p;
}

function queue_mail(string $email,string $subject,string $body): void {
 query('INSERT INTO mail_queue VALUES (?,?,?,?,?,?,?)',[uid('mail-'),$email,$subject,$body,'queued',0,gmdate('c')]);
}
function customer_state(string $id): array {
 $r=one('SELECT data FROM customer_state WHERE id=?',[$id]);return $r?jsondata($r['data']):['cart'=>[],'saved'=>[],'address'=>[]];
}
function put_state(string $id,array $data): void {
 if(one('SELECT id FROM customer_state WHERE id=?',[$id]))query('UPDATE customer_state SET data=? WHERE id=?',[json_encode($data),$id]);
 else query('INSERT INTO customer_state VALUES (?,?)',[$id,json_encode($data)]);
}
