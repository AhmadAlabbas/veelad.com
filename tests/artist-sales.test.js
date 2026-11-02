import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeArtistSales} from '../src/artist-sales.js';
const line=(artist_id,price,extra={})=>({artist_id,price,qty:1,...extra});
test('reports only owner product lines; excludes samples, cancellations and other artists',()=>{
 const orders=[
  {status:'new',payment_status:'awaiting_payment',items:[line('artist-a',1200),line('artist-b',9900)]},
  {status:'processing',payment_status:'paid',items:[line('artist-a',2500,{qty:2}),line('artist-a',200,{sample_pricing:true})]},
  {status:'delivered',payment_status:'paid',items:[line('artist-a',3000)]},
  {status:'cancelled',payment_status:'paid',items:[line('artist-a',4000)]},
  {status:'new',payment_status:'paid',items:[line('artist-b',99999)]},
  {status:'new',payment_status:'demo_unpaid',items:[line('artist-a',500,{stock_is_simulated:true})]}
 ];
 const s=summarizeArtistSales(orders,'artist-a');
 assert.equal(s.orders,5);
 assert.equal(s.recorded_product_sales_minor,9200);
 assert.equal(s.recorded_paid_product_sales_minor,8000);
 assert.equal(s.awaiting_payment_product_sales_minor,1200);
 assert.equal(s.cancelled_product_sales_minor,4000);
 assert.equal(s.sample_product_sales_minor,700);
 assert.equal(s.paid_orders_in_fulfillment,1);
 assert.equal(s.delivered_orders,1);
 assert.equal(s.payout_balance_available,false);
 assert.equal(Object.hasOwn(s,'earnings_minor'),false);
});
test('rejects malformed monetary lines rather than projecting artist earnings',()=>{
 const s=summarizeArtistSales([{status:'processing',payment_status:'paid',items:[
  line('a',100,{qty:0}),line('a',NaN),line('a',100,{qty:1.5}),line('a',200)
 ]}],'a');
 assert.equal(s.recorded_paid_product_sales_minor,200);
 assert.equal(s.units,1);
});
