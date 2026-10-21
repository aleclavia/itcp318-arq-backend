const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => `$${Number(n).toFixed(2)}`;
const shortId = id => String(id).slice(-8).toUpperCase();

const STATUS_TEXT = {
    Processing: 'We have received your payment and are preparing your gear.',
    Shipped: 'Your order is on its way! Large items may arrive separately via freight.',
    Delivered: 'Your order has been delivered. Enjoy! You can now rate and review your products.'
};

exports.orderEmailSubject = order => `ARQANE ARQADE - Order #${shortId(order._id)} is now ${order.orderStatus}`;

exports.orderEmailHtml = (order) => {
    const rows = order.orderItems.map(i => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(i.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${money(i.price)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${money(i.price * i.quantity)}</td>
      </tr>`).join('');
    const s = order.shippingInfo;
    return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#111">
      <div style="background:#0b0f1a;color:#00e5ff;padding:18px 24px;font-size:20px;font-weight:bold">ARQANE ARQADE</div>
      <div style="padding:24px">
        <h2 style="margin-top:0">Hi ${esc(order.user.name)},</h2>
        <p>Your order <b>#${shortId(order._id)}</b> status is now <b>${order.orderStatus}</b>.</p>
        <p>${STATUS_TEXT[order.orderStatus] || ''}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="background:#e8f7fa">
            <th style="padding:8px;text-align:left">Item</th><th style="padding:8px">Qty</th>
            <th style="padding:8px;text-align:right">Price</th><th style="padding:8px;text-align:right">Subtotal</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr><td colspan="3" style="padding:6px 8px;text-align:right">Items subtotal</td><td style="padding:6px 8px;text-align:right">${money(order.itemsPrice)}</td></tr>
            <tr><td colspan="3" style="padding:6px 8px;text-align:right">Tax</td><td style="padding:6px 8px;text-align:right">${money(order.taxPrice)}</td></tr>
            <tr><td colspan="3" style="padding:6px 8px;text-align:right">Shipping</td><td style="padding:6px 8px;text-align:right">${money(order.shippingPrice)}</td></tr>
            <tr><td colspan="3" style="padding:10px 8px;text-align:right;font-weight:bold;font-size:16px">GRAND TOTAL</td>
                <td style="padding:10px 8px;text-align:right;font-weight:bold;font-size:16px">${money(order.totalPrice)}</td></tr>
          </tfoot>
        </table>
        <p style="font-size:13px;color:#555">Shipping to: ${esc(s.address)}, ${esc(s.city)} ${esc(s.postalCode)}, ${esc(s.country)}</p>
        <p style="font-size:13px;color:#555">Your PDF receipt is attached.</p>
      </div>
    </div>`;
};
