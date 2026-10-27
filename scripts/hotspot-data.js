// Hotspot data lives in the image `title` attribute, mirroring how DA persists focal points,
// because the EDS pipeline drops custom data-* attributes on images.
export const HOTSPOT_PREFIX = 'hotspots:';

const FIELDS = ['label', 'title', 'description', 'link'];

const clamp = (n) => Math.min(100, Math.max(0, n));

export function isHotspotData(value) {
  return typeof value === 'string' && value.startsWith(HOTSPOT_PREFIX);
}

export function parseHotspots(value) {
  if (!isHotspotData(value)) return [];
  try {
    const list = JSON.parse(value.slice(HOTSPOT_PREFIX.length));
    if (!Array.isArray(list)) return [];
    return list
      .filter((h) => h && Number.isFinite(Number(h.x)) && Number.isFinite(Number(h.y)))
      .map((h) => ({
        x: clamp(Number(h.x)),
        y: clamp(Number(h.y)),
        ...Object.fromEntries(FIELDS.map((f) => [f, h[f] ? String(h[f]) : ''])),
      }));
  } catch {
    return [];
  }
}

export function serializeHotspots(list) {
  const data = list.map((h) => ({
    x: Number(h.x.toFixed(2)),
    y: Number(h.y.toFixed(2)),
    ...Object.fromEntries(FIELDS.filter((f) => h[f]?.trim()).map((f) => [f, h[f].trim()])),
  }));
  return `${HOTSPOT_PREFIX}${JSON.stringify(data)}`;
}
