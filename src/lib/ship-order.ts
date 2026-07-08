export function canShipDeliveryOrder(order: {
  order_type: string;
  source: string;
  status: string;
}) {
  return (
    order.order_type === "delivery" &&
    !["swiggy", "zomato"].includes(order.source) &&
    order.status !== "paid" &&
    order.status !== "cancelled"
  );
}
