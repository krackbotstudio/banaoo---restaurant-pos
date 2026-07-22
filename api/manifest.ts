/**
 * Vercel serverless function: /api/manifest
 * Returns a restaurant-specific Web App Manifest so Chrome installs
 * the correct restaurant's ordering app (not the generic Flaze app).
 *
 * Query params:
 *   name      - Restaurant name (e.g. "Spice Garden")
 *   start_url - Ordering page path (e.g. "/order/spice-garden")
 *   color     - Brand hex color (e.g. "#f97316")
 */
export default function handler(req: any, res: any) {
  const name = String(req.query?.name || "Order Food");
  const startUrl = String(req.query?.start_url || "/");
  const color = String(req.query?.color || "#FF4500");

  // Truncate short_name to 12 chars (manifest spec recommendation)
  const shortName = name.length > 12 ? name.slice(0, 12) : name;

  const manifest = {
    name,
    short_name: shortName,
    description: `Order food from ${name}`,
    start_url: startUrl,
    scope: startUrl,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: color,
    orientation: "any",
    icons: [
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(manifest));
}
