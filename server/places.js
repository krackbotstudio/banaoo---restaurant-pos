/**
 * Register Google Places API proxy endpoints.
 */
export function registerPlacesRoutes(app) {
  const getGoogleMapsKey = () =>
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';

  // 1. Google Places Autocomplete API
  app.get('/api/places/autocomplete', async (req, res) => {
    const input = (req.query.input || req.query.q || '').toString().trim();
    if (!input || input.length < 2) {
      return res.json({ predictions: [], status: 'EMPTY_INPUT' });
    }

    const apiKey = getGoogleMapsKey();
    if (!apiKey) {
      return res.json({
        predictions: [],
        status: 'NO_API_KEY',
        message: 'GOOGLE_MAPS_API_KEY is not configured in environment',
      });
    }

    try {
      const { lat, lng } = req.query;
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&key=${apiKey}&language=en`;

      if (lat && lng) {
        url += `&location=${lat},${lng}&radius=50000`;
      }

      const response = await fetch(url);
      const data = await response.json();
      console.log(data, "data");
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn('[Google Places Autocomplete API]', data.status, data.error_message);
      }

      const predictions = (data.predictions || []).map((p) => ({
        place_id: p.place_id,
        title: p.structured_formatting?.main_text || p.description.split(',')[0],
        subtitle: p.structured_formatting?.secondary_text || p.description,
        displayName: p.description,
      }));

      return res.json({
        predictions,
        status: data.status,
      });
    } catch (err) {
      console.error('[Google Places Proxy Error]', err);
      return res.status(500).json({ error: 'Failed to fetch places from Google API' });
    }
  });

  // 2. Google Place Details API (fetches lat, lng, formatted address for a place_id)
  app.get('/api/places/details', async (req, res) => {
    const placeId = (req.query.place_id || '').toString().trim();
    if (!placeId) {
      return res.status(400).json({ error: 'place_id is required' });
    }

    const apiKey = getGoogleMapsKey();
    if (!apiKey) {
      return res.status(400).json({ error: 'GOOGLE_MAPS_API_KEY is not configured' });
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
        placeId
      )}&fields=name,geometry,formatted_address&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.result?.geometry?.location) {
        return res.status(400).json({ error: data.error_message || 'Place details not found' });
      }

      const result = data.result;
      return res.json({
        place_id: placeId,
        name: result.name,
        address: result.formatted_address,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      });
    } catch (err) {
      console.error('[Google Place Details Proxy Error]', err);
      return res.status(500).json({ error: 'Failed to fetch place details' });
    }
  });

  // 3. Google Geocoding API (fetches lat & lng for an address string)
  app.get('/api/places/geocode', async (req, res) => {
    const address = (req.query.address || req.query.q || '').toString().trim();
    if (!address) {
      return res.status(400).json({ error: 'address is required' });
    }

    const apiKey = getGoogleMapsKey();
    if (!apiKey) {
      return res.status(400).json({ error: 'GOOGLE_MAPS_API_KEY is not configured' });
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results?.[0]) {
        return res.status(400).json({ error: data.error_message || 'Address not found' });
      }

      const first = data.results[0];
      return res.json({
        formatted_address: first.formatted_address,
        lat: first.geometry.location.lat,
        lng: first.geometry.location.lng,
      });
    } catch (err) {
      console.error('[Google Geocode Proxy Error]', err);
      return res.status(500).json({ error: 'Failed to geocode address' });
    }
  });
  app.get('/api/places/reverse_geocode', async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const apiKey = getGoogleMapsKey();
    if (!apiKey) {
      return res.status(400).json({ error: 'GOOGLE_MAPS_API_KEY is not configured' });
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results?.[0]) {
        return res.status(400).json({ error: data.error_message || 'Address not found' });
      }

      const first = data.results[0];
      let pincode = '';
      let city = '';
      let state = '';

      if (first.address_components) {
        for (const comp of first.address_components) {
          if (comp.types.includes('postal_code')) pincode = comp.long_name;
          if (comp.types.includes('locality')) city = comp.long_name;
          if (!city && comp.types.includes('administrative_area_level_2')) city = comp.long_name;
          if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
        }
      }

      return res.json({
        addressText: first.formatted_address,
        pincode,
        city,
        state,
      });
    } catch (err) {
      console.error('[Google Reverse Geocode Proxy Error]', err);
      return res.status(500).json({ error: 'Failed to reverse geocode' });
    }
  });
}
