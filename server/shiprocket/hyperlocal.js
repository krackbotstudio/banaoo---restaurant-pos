/** Shiprocket Quick — city hyperlocal food delivery (2-wheeler) helpers */

const QUICK_COURIER_RE =
  /quick|hyperlocal|hyper[\s-]?local|2\s*wheel|two[\s-]?wheel|bike|scooter|shadowfax|dunzo|porter|rapido|wefast|borzo/i;

export function extractCouriers(serviceabilityResponse) {
  const data = serviceabilityResponse?.data ?? serviceabilityResponse;
  if (Array.isArray(data)) return data;
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
export const FOOD_ORDER_TYPE = 'Food';

function parseCoord(val) {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

export function extractRiderDetails(data) {
  if (!data) return { rider_name: null, rider_phone: null, rider_vehicle: null, rider_id: null, rider_latitude: null, rider_longitude: null };
  const trackData = data?.tracking_data || {};
  const agent =
    data?.courier_agent_details ||
    trackData?.courier_agent_details ||
    data?.courier_agent ||
    trackData?.courier_agent ||
    data?.delivery_boy ||
    trackData?.delivery_boy ||
    data?.agent ||
    trackData?.agent ||
    data?.rider ||
    trackData?.rider ||
    null;

  const lat = parseCoord(
    agent?.latitude ||
    agent?.lat ||
    agent?.rider_latitude ||
    agent?.rider_lat ||
    trackData?.latitude ||
    trackData?.lat ||
    trackData?.rider_latitude ||
    data?.rider_latitude ||
    data?.latitude ||
    data?.lat
  );

  const lng = parseCoord(
    agent?.longitude ||
    agent?.lng ||
    agent?.rider_longitude ||
    agent?.rider_lng ||
    trackData?.longitude ||
    trackData?.lng ||
    trackData?.rider_longitude ||
    data?.rider_longitude ||
    data?.longitude ||
    data?.lng
  );

  if (!agent || typeof agent !== 'object') {
    return {
      rider_name: null,
      rider_phone: null,
      rider_vehicle: null,
      rider_id: null,
      rider_latitude: lat,
      rider_longitude: lng,
    };
  }

  return {
    rider_name: agent.name || agent.courier_name || agent.rider_name || null,
    rider_phone: agent.phone || agent.courier_phone || agent.rider_phone || null,
    rider_vehicle: agent.vehicle_number || agent.vehicle_details || agent.vehicle || agent.vehicle_no || null,
    rider_id: agent.id != null ? String(agent.id) : (agent.rider_id != null ? String(agent.rider_id) : (agent.courier_agent_id != null ? String(agent.courier_agent_id) : null)),
    rider_latitude: lat,
    rider_longitude: lng,
  };
}

