<?php
// Run from your hosting terminal after uploading a new version.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/core.php';
schema();echo "Veelad schema is up to date. Existing accounts, products and orders are preserved.\n";
