<?php
declare(strict_types=1);

header('Content-Type: application/json');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/../../veelad-app/core.php';

try {
 $c=config();session_name('veelad_session');session_set_cookie_params(['httponly'=>true,'secure'=>$c['secure_cookies']??true,'samesite'=>'Lax','path'=>'/']);ini_set('session.use_strict_mode','1');session_start();$_SESSION['csrf']??=bin2hex(random_bytes(32));
 $route=$_GET['route']??'bootstrap';$method=$_SERVER['REQUEST_METHOD']??'GET';
 if($method==='POST'){$origin=$_SERVER['HTTP_ORIGIN']??'';if($origin!==''&&$origin!==rtrim($c['allowed_origin']??'', '/'))fail(403,'Unrecognized request origin.');csrf();}
 if($route==='setup-status'&&$method==='GET'){schema();out(['csrf'=>$_SESSION['csrf'],'installed'=>(bool)one('SELECT id FROM users WHERE role=?',['admin'])]);}
 if($route==='install'&&$method==='POST'){throttle('setup',5);$v=input();$key=$c['setup_key']??'';if(strlen($key)<32||str_starts_with($key,'REPLACE')||!hash_equals($key,(string)($v['key']??'')))fail(403,'Invalid setup key.');install(emailfield($v),(string)($v['password']??''));out(['ok'=>true]);}

 if($route==='health'&&$method==='GET'){query('SELECT 1');out(['ok'=>true,'version'=>'2.0.0']);}
 if($route==='state'&&$method==='GET'){$u=me(true);out(customer_state($u['id']));}
 if($route==='state'&&$method==='POST'){$u=me(true);$v=input();$state=customer_state($u['id']);
  if(isset($v['cart'])){if(!is_array($v['cart'])||count($v['cart'])>50)fail(422,'Invalid cart.');$items=[];foreach($v['cart'] as $l){$p=one('SELECT * FROM products WHERE id=?',[(string)($l['id']??'')]);$qty=filter_var($l['qty']??null,FILTER_VALIDATE_INT);if(!$p||$qty===false||$qty<1||$qty>20)fail(422,'Invalid cart item.');$variant=(string)($l['variant']??'');if(!in_array($variant,product($p)['variants'],true))fail(422,'Invalid option.');$items[]=['id'=>$p['id'],'key'=>$p['id'].'::'.$variant,'variant'=>$variant,'qty'=>$qty];}$state['cart']=$items;}
  if(isset($v['saved'])){if(!is_array($v['saved'])||count($v['saved'])>500)fail(422,'Too many saved products.');$state['saved']=array_values(array_unique(array_filter(array_map('strval',$v['saved']),fn($id)=>one('SELECT id FROM products WHERE id=?',[$id]))));}
  put_state($u['id'],$state);out(['ok'=>true]);
 }
 if($route==='forgot-password'&&$method==='POST'){throttle('recovery',5);$v=input();$email=emailfield($v);$u=one('SELECT * FROM users WHERE email=? AND status=?',[$email,'active']);if($u){$token=bin2hex(random_bytes(32));db()->beginTransaction();query('DELETE FROM password_resets WHERE user_id=?',[$u['id']]);query('INSERT INTO password_resets VALUES (?,?,?)',[hash('sha256',$token),$u['id'],time()+3600]);queue_mail($email,'Reset your Veelad password','Use this link within one hour: '.rtrim($c['allowed_origin'],'/').'/#/reset?token='.$token."\n\nIf you did not request this, ignore this message.");db()->commit();}out(['ok'=>true,'message'=>'If that account exists, a recovery email has been queued.']);}
 if($route==='reset-password'&&$method==='POST'){throttle('reset',10);$v=input();$token=hash('sha256',textfield($v,'token',100));$pw=(string)($v['password']??'');if(strlen($pw)<12||strlen($pw)>128)fail(422,'Use a password of 12–128 characters.');db()->beginTransaction();$reset=one('SELECT * FROM password_resets WHERE id=? AND expires>?',[$token,time()]);if(!$reset||query('DELETE FROM password_resets WHERE id=?',[$token])->rowCount()!==1){db()->rollBack();fail(422,'This recovery link is invalid or expired.');}query('UPDATE users SET password=? WHERE id=?',[password_hash($pw,PASSWORD_DEFAULT),$reset['user_id']]);query('DELETE FROM password_resets WHERE user_id=?',[$reset['user_id']]);db()->commit();unset($_SESSION['user_id'],$_SESSION['password_stamp']);out(['ok'=>true]);}
 if($route==='admin-record-payment'&&$method==='POST'){$u=role('admin');$v=input();$reference=textfield($v,'reference',150);db()->beginTransaction();$o=one('SELECT * FROM orders WHERE id=?',[(string)($v['id']??'')]);if(!$o||!in_array($o['status'],['awaiting_payment','new'],true)){db()->rollBack();fail(409,'Only an unpaid open order can be confirmed.');}$d=jsondata($o['data']);$d['payment_status']='paid';$d['payment_method']='manual_external';$d['payment_reference']=$reference;$d['paid_at']=gmdate('c');if(query('UPDATE orders SET status=?,data=? WHERE id=? AND status=?',['processing',json_encode($d),$o['id'],$o['status']])->rowCount()!==1){db()->rollBack();fail(409,'Order changed. Refresh first.');}audit($u,'payment.manually_recorded',$o['id']);queue_mail($o['email'],'Veelad payment recorded: '.$o['id'],'The store has recorded your external payment and your order is now processing. Reference: '.$reference);db()->commit();out(['ok'=>true]);}
 if($route==='admin-system'&&$method==='GET'){$u=role('admin');out(['version'=>'2.0.0','database'=>db()->getAttribute(PDO::ATTR_DRIVER_NAME),'mail_enabled'=>(bool)($c['mail_enabled']??false),'queued_emails'=>(int)one('SELECT COUNT(*) AS n FROM mail_queue WHERE status=?',['queued'])['n'],'failed_emails'=>(int)one('SELECT COUNT(*) AS n FROM mail_queue WHERE status=?',['failed'])['n'],'paid_orders'=>count(array_filter(query('SELECT data FROM orders')->fetchAll(),fn($o)=>(jsondata($o['data'])['payment_status']??'')==='paid'))]);}
 if($route==='bootstrap'&&$method==='GET'){out(['mode'=>'server','csrf'=>$_SESSION['csrf'],'user'=>($u=me())?safeuser($u):null,'products'=>products(),'artists'=>publicartists(),'settings'=>settings()]);}
 if($route==='register'&&$method==='POST'){throttle('register',8);$v=input();$name=textfield($v,'name',100);$email=emailfield($v);$pw=(string)($v['password']??'');if(strlen($pw)<12||strlen($pw)>128)fail(422,'Use a password of 12–128 characters.');$role=($v['role']??'buyer')==='artist'?'artist':'buyer';if(one('SELECT id FROM users WHERE email=?',[$email]))fail(409,'This email is already registered.');$id=uid('user-');query('INSERT INTO users VALUES (?,?,?,?,?,?,?)',[$id,$name,$email,password_hash($pw,PASSWORD_DEFAULT),$role,'active',gmdate('c')]);if($role==='artist'){query('INSERT INTO artists VALUES (?,?)',[$id,json_encode(['id'=>$id,'name'=>$name,'initials'=>strtoupper(cliptext($name,2)),'handle'=>$id,'bio'=>'Independent artist on Veelad.','location'=>'','color'=>'#d9d0ff'])]);}session_regenerate_id(true);$_SESSION['user_id']=$id;$_SESSION['password_stamp']=hash('sha256',one('SELECT password FROM users WHERE id=?',[$id])['password']);out(['user'=>safeuser(me(true))]);}
 if($route==='login'&&$method==='POST'){throttle('login',12);$v=input();$u=one('SELECT * FROM users WHERE email=?',[emailfield($v)]);if(!$u||!password_verify((string)($v['password']??''),$u['password'])||$u['status']!=='active')fail(401,'Email or password is incorrect.');session_regenerate_id(true);$_SESSION['user_id']=$u['id'];$_SESSION['password_stamp']=hash('sha256',$u['password']);out(['user'=>safeuser($u)]);}
 if($route==='logout'&&$method==='POST'){unset($_SESSION['user_id']);session_regenerate_id(true);out(['ok'=>true]);}
 if($route==='profile'&&$method==='POST'){$u=me(true);$v=input();query('UPDATE users SET name=? WHERE id=?',[textfield($v,'name',100),$u['id']]);if($u['role']==='artist'){$a=jsondata(one('SELECT data FROM artists WHERE id=?',[$u['id']])['data']);$a['name']=textfield($v,'name',100);$a['bio']=textfield($v,'bio',500,false);$a['location']=textfield($v,'location',100,false);query('UPDATE artists SET data=? WHERE id=?',[json_encode($a),$u['id']]);}out(['user'=>safeuser(me(true))]);}
 if($route==='password'&&$method==='POST'){$u=me(true);$v=input();if(!password_verify((string)($v['current']??''),$u['password']))fail(403,'Current password is incorrect.');$pw=(string)($v['password']??'');if(strlen($pw)<12||strlen($pw)>128)fail(422,'Use a password of 12–128 characters.');query('UPDATE users SET password=? WHERE id=?',[password_hash($pw,PASSWORD_DEFAULT),$u['id']]);$_SESSION['password_stamp']=hash('sha256',one('SELECT password FROM users WHERE id=?',[$u['id']])['password']);session_regenerate_id(true);out(['ok'=>true]);}
 if($route==='message'&&$method==='POST'){throttle('message',10);$v=input();$email=emailfield($v);$type=($v['type']??'contact')==='newsletter'?'newsletter':'contact';$d=['name'=>textfield($v,'name',100,false),'subject'=>textfield($v,'subject',150,false),'message'=>textfield($v,'message',3000,$type==='contact')];query('INSERT INTO messages VALUES (?,?,?,?,?,?)',[uid('msg-'),$type,$email,json_encode($d),'new',gmdate('c')]);out(['ok'=>true]);}
 if($route==='checkout'&&$method==='POST'){
  throttle('checkout',15);$v=input();$set=settings();if(!$set['checkout_enabled'])fail(409,'Checkout is temporarily paused.');$customer=$v['customer']??[];$email=emailfield($customer);$name=textfield($customer,'name',100);$address=textfield($customer,'address',250);$city=textfield($customer,'city',80);$postal=textfield($customer,'postal',20);$phone=textfield($customer,'phone',30);$country=textfield($customer,'country',80);if(empty($v['consent']))fail(422,'Please accept the order terms.');$cart=$v['cart']??[];if(!is_array($cart)||count($cart)<1||count($cart)>50)fail(422,'Your bag needs 1–50 items.');$key=hash('sha256',session_id().'|'.textfield($v,'request_key',100));
  $old=one('SELECT * FROM orders WHERE request_key=?',[$key]);if($old)out(['order'=>orderview($old),'guest_token'=>$_SESSION['order_tokens'][$old['id']]??null]);
  $items=[];$subtotal=0;$id=uid('VLD-');$guest=bin2hex(random_bytes(32));db()->beginTransaction();
  foreach($cart as $item){$p=one('SELECT * FROM products WHERE id=? AND status=?',[(string)($item['id']??''),'active']);$qty=filter_var($item['qty']??null,FILTER_VALIDATE_INT);if(!$p||$qty===false||$qty<1||$qty>20){db()->rollBack();fail(422,'A bag item is unavailable or has an invalid quantity.');}$p=product($p);$variant=(string)($item['variant']??'');if(!in_array($variant,$p['variants'],true)){db()->rollBack();fail(422,'Choose a valid product option.');}if(query('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?',[$qty,$p['id'],$qty])->rowCount()!==1){db()->rollBack();fail(409,'There is not enough stock for '.$p['title'].'.');}$line=['id'=>$p['id'],'title'=>$p['title'],'category'=>$p['category'],'artist_id'=>$p['artist_id'],'variant'=>$variant,'qty'=>$qty,'price'=>$p['price'],'sheet'=>$p['sheet']??0,'cell'=>$p['cell']??0,'upload_id'=>$p['upload_id']??null,'royalty_percent'=>$p['royalty_percent']??20];$items[]=$line;$subtotal+=$p['price']*$qty;}
  $code=strtoupper(trim((string)($v['coupon']??'')));$discount=$code!==''&&$code===($set['coupon_code']??'HELLOVEELAD')?(int)round($subtotal*($set['coupon_percent']??10)/100):0;$shipping=$subtotal-$discount>=$set['free_shipping']?0:(int)$set['shipping'];$total=$subtotal-$discount+$shipping;$u=me();$data=['customer'=>compact('name','email','address','city','postal','phone','country'),'items'=>$items,'subtotal'=>$subtotal,'shipping'=>$shipping,'discount'=>$discount,'payment_status'=>'awaiting_payment','tracking'=>'','note'=>'Order received. Awaiting payment; do not fulfill until payment is confirmed.'];query('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?)',[$id,$u['id']??null,$email,'awaiting_payment',$total,json_encode($data),hash('sha256',$guest),$key,gmdate('c')]);queue_mail($email,'Veelad order received: '.$id,'Your order '.$id.' has been received and is awaiting payment. No charge has been made. Total: SAR '.number_format($total/100,2).'. Track: '.rtrim($c['allowed_origin'],'/').'/#/track?id='.rawurlencode($id).'&token='.rawurlencode($guest));if($u){$state=customer_state($u['id']);$state['cart']=[];$state['address']=$data['customer'];put_state($u['id'],$state);}db()->commit();$_SESSION['order_tokens'][$id]=$guest;out(['order'=>orderview(one('SELECT * FROM orders WHERE id=?',[$id])),'guest_token'=>$guest]);
 }
 if($route==='orders'&&$method==='GET'){$u=me(true);out(['orders'=>array_map('orderview',query('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC',[$u['id']])->fetchAll())]);}
 if($route==='order'&&$method==='GET'){$o=one('SELECT * FROM orders WHERE id=?',[(string)($_GET['id']??'')]);$u=me();$token=(string)($_GET['token']??'');if(!$o||!(($u&&($u['id']===$o['user_id']||$u['role']==='admin'))||($token!==''&&hash_equals($o['guest_hash'],hash('sha256',$token)))))fail(404,'Order not found. Sign in or use your private tracking code.');out(['order'=>orderview($o)]);}

 if($route==='upload'&&$method==='POST'){
  $u=role('artist','admin');
  throttle('upload',25);
  $f=$_FILES['artwork']??null;
  if(!$f||$f['error']!==UPLOAD_ERR_OK||$f['size']>8*1024*1024)fail(422,'Upload a PNG or JPEG under 8 MB.');
  $info=getimagesize($f['tmp_name']);
  if(!$info||!in_array($info['mime'],['image/png','image/jpeg'],true)||$info[0]*$info[1]>36000000||$info[0]<100||$info[1]<100)fail(422,'Use a valid PNG/JPEG, at least 100 px and at most 36 megapixels.');
  $id=uid('art-');
  $name=$id.($info['mime']==='image/png'?'.png':'.jpg');
  $folder=__DIR__ . '/../../veelad-app/uploads';
  if(!is_dir($folder))mkdir($folder,0700,true);
  if(!move_uploaded_file($f['tmp_name'],$folder.'/'.$name))fail(500,'Artwork could not be saved.');
  query('INSERT INTO uploads VALUES (?,?,?,?)',[$id,$u['id'],$name,$info['mime']]);
  out(['upload_id'=>$id]);
 }

 if($route==='image'&&$method==='GET'){
  $a=one('SELECT * FROM uploads WHERE id=?',[(string)($_GET['id']??'')]);
  if(!$a)fail(404,'Artwork not found.');
  $u=me();
  $isPublic=false;
  foreach(products() as $p){
   if(($p['upload_id']??'')===$a['id']){
    $isPublic=true;
    break;
   }
  }
  if(!$isPublic&&(!$u||($u['id']!==$a['user_id']&&$u['role']!=='admin')))fail(404,'Artwork not found.');
  header('Content-Type: '.$a['mime']);
  header('Content-Disposition: inline');
  readfile(__DIR__ . '/../../veelad-app/uploads/'.$a['path']);
  exit;
 }

 if($route==='studio'&&$method==='GET'){$u=role('artist');$orders=[];foreach(query('SELECT * FROM orders ORDER BY created_at DESC')->fetchAll() as $o){$d=orderview($o);$lines=array_values(array_filter($d['items'],fn($l)=>$l['artist_id']===$u['id']));if($lines)$orders[]=['id'=>$o['id'],'status'=>$o['status'],'created_at'=>$o['created_at'],'items'=>$lines,'payment_status'=>$d['payment_status']??'awaiting_payment'];}out(['products'=>products(true,$u['id']),'orders'=>$orders]);}
 if($route==='artist-product'&&$method==='POST'){$u=role('artist');$v=input();$p=validproduct($v);if(empty($p['upload_id']))fail(422,'Upload your original artwork first.');$id=$v['id']??uid('p-');$old=one('SELECT * FROM products WHERE id=?',[$id]);if($old&&$old['artist_id']!==$u['id'])fail(403,'You can only edit your own products.');if($old)query('UPDATE products SET data=?,stock=?,status=? WHERE id=?',[json_encode($p),$p['stock'],'pending',$id]);else query('INSERT INTO products VALUES (?,?,?,?,?,?)',[$id,$u['id'],'pending',$p['stock'],json_encode($p),gmdate('c')]);out(['id'=>$id,'status'=>'pending']);}
 if(str_starts_with($route,'admin')){$u=role('admin');
  if($route==='admin'&&$method==='GET'){out(['products'=>products(true),'users'=>array_map('safeuser',query('SELECT * FROM users ORDER BY created_at DESC')->fetchAll()),'orders'=>array_map('orderview',query('SELECT * FROM orders ORDER BY created_at DESC')->fetchAll()),'messages'=>array_map(fn($r)=>array_merge(jsondata($r['data']),array_diff_key($r,['data'=>true])),query('SELECT * FROM messages ORDER BY created_at DESC')->fetchAll()),'settings'=>settings(),'audit'=>query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 30')->fetchAll()]);}
  if($route==='admin-product'&&$method==='POST'){$v=input();$p=validproduct($v);$id=$v['id']??uid('p-');$artist=textfield($v,'artist_id',64);if(!one('SELECT id FROM artists WHERE id=?',[$artist]))fail(422,'Choose a valid artist.');$status=$v['status']??'active';if(!in_array($status,['active','pending','archived'],true))fail(422,'Invalid product status.');if(one('SELECT id FROM products WHERE id=?',[$id]))query('UPDATE products SET data=?,stock=?,artist_id=?,status=? WHERE id=?',[json_encode($p),$p['stock'],$artist,$status,$id]);else query('INSERT INTO products VALUES (?,?,?,?,?,?)',[$id,$artist,$status,$p['stock'],json_encode($p),gmdate('c')]);audit($u,'product.save',$id);out(['ok'=>true]);}
  if($route==='admin-order'&&$method==='POST'){$v=input();$o=one('SELECT * FROM orders WHERE id=?',[$v['id']??'']);if(!$o)fail(404,'Order not found.');$next=$v['status']??'';$allowed=['awaiting_payment'=>['cancelled'],'new'=>['cancelled'],'processing'=>['shipped','cancelled'],'shipped'=>['delivered'],'delivered'=>[],'cancelled'=>[]];if($next!==$o['status']&&!in_array($next,$allowed[$o['status']]??[],true))fail(409,'This order status transition is not allowed.');$d=jsondata($o['data']);$d['tracking']=textfield($v,'tracking',100,false);if($next==='cancelled'&&($d['payment_status']??'')==='paid')$d['payment_status']='refund_required';db()->beginTransaction();if(query('UPDATE orders SET status=?,data=? WHERE id=? AND status=?',[$next,json_encode($d),$o['id'],$o['status']])->rowCount()===0&&$next!==$o['status']){db()->rollBack();fail(409,'Order was updated. Refresh first.');}if($next==='cancelled'&&$o['status']!=='cancelled')foreach($d['items'] as $l)query('UPDATE products SET stock=stock+? WHERE id=?',[$l['qty'],$l['id']]);audit($u,'order.'.$next,$o['id']);db()->commit();out(['ok'=>true]);}
  if($route==='admin-user'&&$method==='POST'){$v=input();$id=textfield($v,'id',64);if($id===$u['id'])fail(422,'You cannot suspend your own admin account.');$target=one('SELECT * FROM users WHERE id=?',[$id]);if(!$target||$target['role']==='admin')fail(422,'Administrator accounts cannot be changed here.');$status=$v['status']??'';if(!in_array($status,['active','suspended'],true))fail(422,'Invalid status.');query('UPDATE users SET status=? WHERE id=?',[$status,$id]);audit($u,'user.'.$status,$id);out(['ok'=>true]);}
  if($route==='admin-message'&&$method==='POST'){$v=input();query('UPDATE messages SET status=? WHERE id=?',['resolved',$v['id']??'']);audit($u,'message.resolve',(string)($v['id']??''));out(['ok'=>true]);}
  if($route==='admin-settings'&&$method==='POST'){$v=input();$s=settings();$s['announcement']=textfield($v,'announcement',150);$s['support_email']=emailfield($v,'support_email');foreach(['shipping','free_shipping'] as $key){$num=filter_var($v[$key]??null,FILTER_VALIDATE_INT);if($num===false||$num<0||$num>100000)fail(422,'Check shipping amounts.');$s[$key]=$num;}$s['checkout_enabled']=(bool)($v['checkout_enabled']??false);$s['coupon_code']=strtoupper(textfield($v,'coupon_code',30,false));$percent=filter_var($v['coupon_percent']??0,FILTER_VALIDATE_INT);if($percent===false||$percent<0||$percent>70)fail(422,'Discount must be 0–70 percent.');$s['coupon_percent']=$percent;query('UPDATE settings SET data=? WHERE id=?',[json_encode($s),'store']);audit($u,'settings.save','store');out(['ok'=>true]);}
 }
 fail(404,'Endpoint not found.');
} catch(Throwable $e){
 if(isset($c)){
  try{
   if(db()->inTransaction())db()->rollBack();
  }catch(Throwable){}
 }
 error_log('Veelad API: '.$e->getMessage());
 fail(500,'The server could not complete this request. Check configuration or try again.');
}