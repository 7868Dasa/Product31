/**
 * Shop QR code + printable poster (spec §11). Both generated locally — no
 * external API, no headless browser:
 *   - QR    : `qrcode` npm
 *   - poster: `pdfkit` (lightweight; built-in Helvetica, no font files)
 *
 * The QR encodes the permanent deep link `${PUBLIC_WEB_BASE_URL}/s/{slug}`,
 * which routes straight to that shop's ordering screen (spec §11.2).
 */
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { config } from '../../config.js';

export function shopUrl(slug) {
  return `${config.PUBLIC_WEB_BASE_URL.replace(/\/+$/, '')}/s/${slug}`;
}

export async function buildQrPng(slug, { width = 600 } = {}) {
  return QRCode.toBuffer(shopUrl(slug), {
    type: 'png',
    width,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#1c1917', light: '#ffffff' },
  });
}

/**
 * A4 poster: shop name, big high-error-correction QR, instruction line, the
 * URL as text, and the address for the shopkeeper's reference. High contrast,
 * plain layout — must print on an ordinary printer (spec §11.1).
 */
export async function buildPosterPdf({ slug, shopName, address }) {
  const url = shopUrl(slug);
  const qrPng = await QRCode.toBuffer(url, {
    type: 'png',
    width: 1000,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const contentW = doc.page.width - 112;

    doc.moveDown(1);
    doc.fillColor('#1c1917').font('Helvetica-Bold').fontSize(34).text(shopName, { align: 'center' });
    doc.moveDown(0.4);
    doc
      .font('Helvetica')
      .fontSize(17)
      .fillColor('#444')
      .text('Scan to order ahead & skip the line!', { align: 'center' });

    doc.moveDown(1.2);
    const qrSize = Math.min(contentW, 400);
    const qrX = (doc.page.width - qrSize) / 2;
    doc.image(qrPng, qrX, doc.y, { width: qrSize, height: qrSize });
    doc.y += qrSize + 24;

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1c1917').text(url, { align: 'center' });
    doc.moveDown(2);
    if (address) {
      doc.font('Helvetica').fontSize(11).fillColor('#777').text(address, { align: 'center' });
    }
    doc.moveDown(1.5);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#999')
      .text('Powered by Product 31', { align: 'center' });

    doc.end();
  });
}
