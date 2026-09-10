/**
 * Print a pickup ticket for the counter. Opens a bare window and calls
 * window.print() — same zero-dependency pattern as the shop poster and the
 * spend report. Sized for a 58/80mm thermal roll but prints fine on A4 too.
 */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {object} order  a serialized order (shopkeeper/owner shape)
 * @param {(k: string, v?: object) => string} t  i18n
 * @param {'en'|'ta'} lang
 */
export function printOrderTicket(order, t, lang = 'en') {
  const nameOf = (it) => (lang === 'ta' && it.name_ta ? it.name_ta : it.name);
  const when = new Date(order.created_at).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  const rows = (order.items || [])
    .map(
      (it) => `
        <tr>
          <td class="q">${esc(it.quantity)}×</td>
          <td class="n">${esc(nameOf(it))}${it.pack_size ? ` <span class="p">${esc(it.pack_size)}</span>` : ''}</td>
          <td class="a">${it.line_total != null ? '₹' + esc(it.line_total) : ''}</td>
        </tr>`,
    )
    .join('');

  const total =
    order.subtotal_amount != null ? `₹${esc(order.subtotal_amount)}` : esc(t('shop.priceAtCounter'));

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(order.order_code)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 76mm; padding: 4mm; font: 12px/1.35 -apple-system, "Noto Sans Tamil", system-ui, sans-serif; color: #000; }
  h1 { font-size: 14px; text-align: center; }
  .code { font-size: 30px; font-weight: 800; letter-spacing: 3px; text-align: center; margin: 4px 0 2px; }
  .meta { text-align: center; font-size: 11px; margin-bottom: 6px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  td.q { width: 9mm; font-weight: 700; }
  td.a { text-align: right; white-space: nowrap; }
  .p { color: #444; font-size: 10px; }
  .tot { display: flex; justify-content: space-between; font-weight: 800; font-size: 14px; margin-top: 4px; }
  .foot { margin-top: 6px; font-size: 11px; }
  @media print { @page { margin: 0; } }
</style></head><body>
  <h1>${esc(order.shop_name || '')}</h1>
  <div class="code">${esc(order.order_code)}</div>
  <div class="meta">${esc(when)}</div>
  <hr>
  <table>${rows}</table>
  <hr>
  <div class="tot"><span>${esc(t('sk.total'))}</span><span>${total}</span></div>
  <div class="foot">
    ${esc(t('sk.customer'))}: ${esc(order.customer_name || '')}<br>
    ${esc(t('sk.pickup'))}: ${esc(
      !order.pickup_slot_label || order.pickup_slot_label === 'ASAP'
        ? t('pickup.asap')
        : order.pickup_slot_label,
    )}<br>
    ${esc(t('cart.codNote'))}
  </div>
  <script>window.onload = function () { window.print(); setTimeout(function () { window.close(); }, 300); };<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=380,height=640');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
