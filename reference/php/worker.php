<?php
// Private CLI email worker. Suggested cron interval: every 5 minutes.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/core.php';
$c=config();if(empty($c['mail_enabled'])){echo "Email delivery is disabled in config.php.\n";exit;}
$from=$c['mail_from']??'';if(!filter_var($from,FILTER_VALIDATE_EMAIL))throw new RuntimeException('Configure a valid sender.');
$lock=fopen(__DIR__.'/worker.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))exit;
foreach(query("SELECT * FROM mail_queue WHERE status='queued' ORDER BY created_at LIMIT 30")->fetchAll() as $m){
 if(!filter_var($m['email'],FILTER_VALIDATE_EMAIL))continue;
 $subject=str_replace(["\r","\n"],'',$m['subject']);
 $ok=mail($m['email'],$subject,$m['body'],['From'=>$from,'Content-Type'=>'text/plain; charset=UTF-8']);
 $attempts=(int)$m['attempts']+1;query('UPDATE mail_queue SET status=?,attempts=? WHERE id=?',[$ok?'sent':($attempts>=5?'failed':'queued'),$attempts,$m['id']]);
}
query('DELETE FROM password_resets WHERE expires<?',[time()]);
flock($lock,LOCK_UN);fclose($lock);echo "Mail queue processed.\n";
