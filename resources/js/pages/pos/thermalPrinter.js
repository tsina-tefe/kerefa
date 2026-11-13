/**
 * Thermal Printer ESC/POS 80mm Formatting Utility
 * Hardware Target: Model IRP 200D (Thermal Receipt / Order Printer)
 */

export function buildIrp200dTicketHtml(order, ticket, appName = 'KEREFA RESTAURANT') {
    const station = ticket.order_station || ticket.station;
    const stationName = station ? station.name : (ticket.department ? ticket.department.toUpperCase() + ' STATION' : 'ORDER STATION');
    const printerModel = station ? (station.printer_model || 'IRP 200D') : 'IRP 200D';
    const tableName = order.table ? ('T-' + order.table.table_number) : (order.order_type ? order.order_type.toUpperCase() : 'ORDER');
    const waiterName = order.waiter ? order.waiter.name : 'Staff';
    const nowStr = new Date().toLocaleString();

    let itemsHtml = '';
    if (ticket.items && ticket.items.length > 0) {
        ticket.items.forEach(ti => {
            const name = ti.order_item?.name || ti.order_item?.menu_item?.name || 'Item';
            const note = ti.special_instructions || ti.order_item?.special_instructions || ti.notes;
            const notes = note ? `<div class="irp200d-item-notes">** ${note} **</div>` : '';
            itemsHtml += `
                <tr>
                    <td class="irp200d-item-qty">${ti.quantity}</td>
                    <td class="irp200d-item-name">${name}${notes}</td>
                </tr>
            `;
        });
    }

    return `
        <div class="irp200d-ticket-header">
            <div class="irp200d-title">${appName.toUpperCase()}</div>
            <div style="font-size: 11px; margin: 2px 0;">PREPARATION ORDER TICKET</div>
            <div class="irp200d-banner">*** ${stationName.toUpperCase()} ***</div>
        </div>
        <div class="irp200d-meta-row">
            <span>ORDER: <strong>${order.order_number}</strong></span>
            <span>TICKET: <strong>#${ticket.ticket_number}</strong></span>
        </div>
        <div class="irp200d-meta-row">
            <span>TABLE: <strong>${tableName}</strong></span>
            <span>WAITER: ${waiterName}</span>
        </div>
        <div class="irp200d-meta-row">
            <span>TIME: ${nowStr}</span>
            <span>PRINTER: ${printerModel}</span>
        </div>
        <table class="irp200d-items-table">
            <thead>
                <tr>
                    <th style="width: 28px;">QTY</th>
                    <th>ITEM / SPECIAL PREPARATION</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>
        <div class="irp200d-cutter-feed">
            [ TEAR TICKET / IRP 200D AUTO CUT ]
        </div>
    `;
}

export function buildIrp200dSettlementReceiptHtml(order, paymentMethod = 'CASH', amountTendered = 0, appName = 'KEREFA RESTAURANT') {
    const tableName = order.table ? ('T-' + order.table.table_number) : (order.order_type ? order.order_type.toUpperCase() : 'ORDER');
    const waiterName = order.waiter ? order.waiter.name : 'Staff';
    const nowStr = new Date().toLocaleString();
    const totalAmount = parseFloat(order.total_amount || 0);
    const tendered = parseFloat(amountTendered || totalAmount);
    const change = Math.max(0, tendered - totalAmount);

    let itemsHtml = '';
    if (order.items && order.items.length > 0) {
        order.items.forEach(it => {
            if (it.status === 'cancelled') return;
            const name = it.name || it.menu_item?.name || 'Item';
            const total = parseFloat(it.subtotal || it.total_price || (it.quantity * it.unit_price) || 0).toFixed(2);
            itemsHtml += `
                <tr>
                    <td class="irp200d-item-qty">${it.quantity}</td>
                    <td class="irp200d-item-name">${name}</td>
                    <td style="text-align: right; font-family: monospace;">${total}</td>
                </tr>
            `;
        });
    }

    const subtotal = parseFloat(order.subtotal || 0);
    const serviceCharge = parseFloat(order.service_charge_amount || 0);
    const vat = parseFloat(order.tax_amount || 0);

    return `
        <div class="irp200d-ticket-header">
            <div class="irp200d-title">${appName.toUpperCase()}</div>
            <div style="font-size: 11px; margin: 2px 0;">SETTLEMENT RECEIPT (PAID)</div>
            <div class="irp200d-banner">*** PAYMENT CONFIRMED ***</div>
        </div>
        <div class="irp200d-meta-row">
            <span>ORDER: <strong>${order.order_number}</strong></span>
            <span>STATUS: <strong>PAID</strong></span>
        </div>
        <div class="irp200d-meta-row">
            <span>TABLE: <strong>${tableName}</strong></span>
            <span>WAITER: ${waiterName}</span>
        </div>
        <div class="irp200d-meta-row">
            <span>TIME: ${nowStr}</span>
            <span>METHOD: <strong>${paymentMethod.toUpperCase()}</strong></span>
        </div>
        <table class="irp200d-items-table">
            <thead>
                <tr>
                    <th style="width: 28px;">QTY</th>
                    <th>ITEM</th>
                    <th style="text-align: right;">ETB</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>
        <div style="border-top: 1px dashed #000; margin: 6px 0; padding-top: 4px;">
            <div class="irp200d-meta-row">
                <span>SUBTOTAL:</span>
                <span>ETB ${subtotal.toFixed(2)}</span>
            </div>
            <div class="irp200d-meta-row">
                <span>SERVICE CHARGE:</span>
                <span>ETB ${serviceCharge.toFixed(2)}</span>
            </div>
            <div class="irp200d-meta-row">
                <span>VAT:</span>
                <span>ETB ${vat.toFixed(2)}</span>
            </div>
            <div class="irp200d-meta-row" style="font-size: 13px;">
                <span><strong>TOTAL:</strong></span>
                <span><strong>ETB ${totalAmount.toFixed(2)}</strong></span>
            </div>
            <div class="irp200d-meta-row">
                <span>TENDERED:</span>
                <span>ETB ${tendered.toFixed(2)}</span>
            </div>
            <div class="irp200d-meta-row">
                <span>CHANGE:</span>
                <span>ETB ${change.toFixed(2)}</span>
            </div>
        </div>
        <div style="text-align: center; font-size: 11px; margin-top: 8px;">
            Thank you for dining with us!<br>
            Please come again.
        </div>
        <div class="irp200d-cutter-feed">
            [ TEAR TICKET / IRP 200D AUTO CUT ]
        </div>
    `;
}

export function printIrp200d(ticketHtml) {
    if (window.printIrp200dTicket) {
        window.printIrp200dTicket(ticketHtml);
    } else {
        console.warn('printIrp200dTicket utility not mounted on window');
    }
}
