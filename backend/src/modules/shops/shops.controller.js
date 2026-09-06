import * as service from './shops.service.js';
import { buildQrPng, buildPosterPdf, shopUrl } from './poster.service.js';

export async function listNearby(req, res) {
  const { lat, lng, radius_km } = req.query;
  const shops = await service.findNearbyShops({ lat, lng, radius_km });
  res.json({ origin: { lat, lng }, radius_km, count: shops.length, shops });
}

export async function getOne(req, res) {
  const shop = await service.getShopBySlug(req.params.slug);
  res.json({ shop });
}

export async function getInventory(req, res) {
  const items = await service.getShopInventory(req.params.slug);
  res.json({ count: items.length, items });
}

export async function createShop(req, res) {
  const shop = await service.createShop(req.user.id, req.body);
  res.status(201).json({ shop, share_url: shopUrl(shop.slug) });
}

export async function listMine(req, res) {
  const shops = await service.listShopsOwnedBy(req.user.id);
  res.json({ count: shops.length, shops });
}

export async function qrPng(req, res) {
  await service.getShopBySlug(req.params.slug); // 404s if unknown
  const png = await buildQrPng(req.params.slug);
  res.type('png').set('Cache-Control', 'public, max-age=3600').send(png);
}

export async function posterPdf(req, res) {
  const shop = await service.getShopBySlug(req.params.slug);
  const pdf = await buildPosterPdf({
    slug: shop.slug,
    shopName: shop.shop_name,
    address: shop.address,
  });
  res
    .type('pdf')
    .set('Content-Disposition', `attachment; filename="product31-${shop.slug}.pdf"`)
    .send(pdf);
}
