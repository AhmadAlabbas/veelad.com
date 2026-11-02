/* Read-only artist sales facts. This is not a royalty or payout ledger. */
export function summarizeArtistSales(orders, artistId) {
  const summary = {
    orders: 0, units: 0, recorded_product_sales_minor: 0,
    recorded_paid_product_sales_minor: 0, awaiting_payment_product_sales_minor: 0,
    sample_product_sales_minor: 0, cancelled_product_sales_minor: 0,
    paid_orders_in_fulfillment: 0, delivered_orders: 0, awaiting_payment_orders: 0,
    payout_balance_available: false
  };
  for (const order of orders || []) {
    const lines = (order.items || []).filter(line => line.artist_id === artistId);
    if (!lines.length) continue;
    summary.orders++;
    const cancelled = order.status === 'cancelled';
    const paid = order.payment_status === 'paid';
    let commercial = 0, sample = 0;
    for (const line of lines) {
      const qty = Number(line.qty), price = Number(line.price);
      if (!Number.isSafeInteger(qty) || qty < 1 || !Number.isSafeInteger(price) || price < 0 ||
          !Number.isSafeInteger(price * qty)) continue;
      summary.units += qty;
      if (line.sample_pricing === true || line.stock_is_simulated === true) sample += price * qty;
      else commercial += price * qty;
    }
    if (cancelled) {
      summary.cancelled_product_sales_minor += commercial;
      continue;
    }
    summary.sample_product_sales_minor += sample;
    summary.recorded_product_sales_minor += commercial;
    if (paid) {
      summary.recorded_paid_product_sales_minor += commercial;
      if (order.status === 'delivered') summary.delivered_orders++;
      else if (!['shipped'].includes(order.status)) summary.paid_orders_in_fulfillment++;
    } else {
      summary.awaiting_payment_product_sales_minor += commercial;
      summary.awaiting_payment_orders++;
    }
  }
  return summary;
}
