const PDFDocument = require('pdfkit');

const money = n => `$${Number(n).toFixed(2)}`; // Helvetica has no peso sign; use "PHP " here if you switch currency
const shortId = id => String(id).slice(-8).toUpperCase();

// order must have .user populated with { name, email }. Returns Promise<Buffer>
module.exports = (order) => new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 50, right = 545;

    doc.rect(0, 0, 595, 90).fill('#0b0f1a');
    doc.fillColor('#00e5ff').fontSize(22).font('Helvetica-Bold').text('ARQANE ARQADE', left, 30);
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica').text('know the tech. live the game.', left, 58);
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('RECEIPT', 400, 36, { width: 145, align: 'right' });

    doc.fillColor('#000000').fontSize(10).font('Helvetica');
    let y = 110;
    doc.font('Helvetica-Bold').text(`Order #${shortId(order._id)}`, left, y);
    doc.font('Helvetica').text(`Date: ${new Date(order.paidAt || order.createdAt).toLocaleString('en-US')}`, left, y + 14);
    doc.text(`Status: ${order.orderStatus}`, left, y + 28);

    doc.font('Helvetica-Bold').text('Billed to', 320, y);
    doc.font('Helvetica').text(`${order.user.name}\n${order.user.email}`, 320, y + 14);

    y += 66;
    const s = order.shippingInfo;
    doc.font('Helvetica-Bold').text('Ship to', left, y);
    doc.font('Helvetica').text(`${s.address}, ${s.city} ${s.postalCode}, ${s.country}  |  Tel: ${s.phoneNo}`, left, y + 14, { width: right - left });

    y += 50;
    const header = (yy) => {
        doc.rect(left, yy, right - left, 20).fill('#e8f7fa');
        doc.fillColor('#000').font('Helvetica-Bold').fontSize(10);
        doc.text('Item', left + 6, yy + 6);
        doc.text('Qty', 330, yy + 6, { width: 30, align: 'right' });
        doc.text('Unit price', 365, yy + 6, { width: 70, align: 'right' });
        doc.text('Subtotal', 440, yy + 6, { width: 100, align: 'right' });
        return yy + 26;
    };
    y = header(y);

    doc.font('Helvetica').fontSize(10);
    for (const item of order.orderItems) {
        const h = doc.heightOfString(item.name, { width: 265 });
        if (y + h > 740) { doc.addPage(); y = header(50); doc.font('Helvetica').fontSize(10); }
        doc.fillColor('#000');
        doc.text(item.name, left + 6, y, { width: 265 });
        doc.text(String(item.quantity), 330, y, { width: 30, align: 'right' });
        doc.text(money(item.price), 365, y, { width: 70, align: 'right' });
        doc.text(money(item.price * item.quantity), 440, y, { width: 100, align: 'right' });
        y += Math.max(h, 12) + 8;
        doc.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor('#dddddd').lineWidth(0.5).stroke();
    }

    if (y > 640) { doc.addPage(); y = 50; }
    y += 10;
    const row = (label, value, bold) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor('#000');
        doc.text(label, 340, y, { width: 100, align: 'right' });
        doc.text(value, 440, y, { width: 100, align: 'right' });
        y += bold ? 20 : 16;
    };
    row('Items subtotal', money(order.itemsPrice));
    row('Tax (12%)', money(order.taxPrice));
    row('Shipping', money(order.shippingPrice));
    doc.moveTo(340, y).lineTo(right, y).strokeColor('#000').lineWidth(1).stroke();
    y += 6;
    row('GRAND TOTAL', money(order.totalPrice), true);

    doc.font('Helvetica').fontSize(9).fillColor('#666666')
        .text('Thank you for shopping with ARQANE ARQADE. This receipt was generated automatically.', left, y + 30, { width: right - left, align: 'center' });
    doc.end();
});
