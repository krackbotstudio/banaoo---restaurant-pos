/** Shiprocket Quick — city hyperlocal food delivery (2-wheeler) helpers */

const QUICK_COURIER_RE =
  /quick|hyperlocal|hyper[\s-]?local|2\s*wheel|two[\s-]?wheel|bike|scooter|shadowfax|dunzo|porter|rapido|wefast|borzo/i;

export function extractCouriers(serviceabilityResponse) {
  const data = serviceabilityResponse?.data ?? serviceabilityResponse;
  const list =
    data?.available_courier_companies ??
    data?.available_courier_company_ids ??
    data?.courier_companies ??
    [];
  return Array.isArray(list) ? list : [];
}

export function pickQuickCourier(couriers) {
  if (!Array.isArray(couriers) || couriers.length === 0) return null;
  const preferred = couriers.find((c) => {
    const name = String(c.courier_name || c.name || c.company_name || '').toLowerCase();
    return QUICK_COURIER_RE.test(name);
  });
  return preferred || couriers[0];
}

export function courierIdFrom(courier) {
  if (!courier) return null;
  const id = courier.courier_company_id ?? courier.courier_id ?? courier.id;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

export const QUICK_SHIPPING_METHOD = 'SR_QUICK';
export const FOOD_ORDER_TYPE = 'ESSENTIALS';
