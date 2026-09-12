import * as service from './orders.service.js';

export async function place(req, res) {
  const order = await service.placeOrder({
    userId: req.user.id,
    slug: req.params.slug,
    items: req.body.items,
    idempotencyKey: req.body.idempotency_key,
    pickupSlotLabel: req.body.pickup_slot_label,
  });
  res.status(201).json({ order });
}

export async function shopQueue(req, res) {
  const orders = await service.listShopQueue({
    ownerUserId: req.user.id,
    slug: req.params.slug,
    status: req.query.status,
  });
  res.json({ count: orders.length, orders });
}

export async function myOrders(req, res) {
  const orders = await service.listMyOrders({ userId: req.user.id });
  res.json({ count: orders.length, orders });
}

export async function getOne(req, res) {
  const order = await service.getOrder({ actorUserId: req.user.id, orderId: req.params.id });
  res.json({ order });
}

export async function transition(req, res) {
  const order = await service.transition({
    actorUserId: req.user.id,
    orderId: req.params.id,
    action: req.body.action,
    reason: req.body.reason,
    unavailableItemIds: req.body.unavailable_item_ids,
  });
  res.json({ order });
}

export async function updatePickup(req, res) {
  const order = await service.updatePickup({
    actorUserId: req.user.id,
    orderId: req.params.id,
    pickupSlotLabel: req.body.pickup_slot_label,
  });
  res.json({ order });
}
