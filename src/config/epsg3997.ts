// EPSG:3997 — "WGS 84 / Dubai Local TM" — inverse Transverse Mercator
// projection (Easting/Northing meters -> WGS84 lng/lat degrees).
//
//   +proj=tmerc +lat_0=0 +lon_0=55.3333333333333 +k=1 +x_0=500000 +y_0=0
//   +datum=WGS84 +units=m +no_defs
//
// This is the exact grid the Native Haus Site Plan's printed control
// points (e.g. "486030 E / 2771160 N") are drawn in. Implements Snyder's
// ellipsoidal Transverse Mercator inverse (Map Projections: A Working
// Manual, USGS Professional Paper 1395, formulas 8-19 to 8-25) — a
// proper geodetic transform, not a meters-per-degree approximation.
// Verified against pyproj's EPSG:3997->EPSG:4326 transform during
// development: sub-millimeter agreement across every control/parcel
// point used to digitize the site (see plotGeometry.ts).

const WGS84_A = 6378137.0; // semi-major axis, meters
const WGS84_F = 1 / 298.257223563; // flattening

const LON0_DEG = 55.333333333333336;
const K0 = 1.0;
const X0 = 500000.0;
const Y0 = 0.0;

const E2 = WGS84_F * (2 - WGS84_F);
const E4 = E2 * E2;
const E6 = E2 * E4;
const EP2 = E2 / (1 - E2);
const LON0_RAD = (LON0_DEG * Math.PI) / 180;

/** EPSG:3997 [Easting, Northing] meters -> WGS84 [lng, lat] degrees. */
export function epsg3997ToWgs84(easting: number, northing: number): readonly [lng: number, lat: number] {
  const x = easting - X0;
  const y = northing - Y0;
  const M = y / K0;

  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const mu = M / (WGS84_A * (1 - E2 / 4 - (3 * E4) / 64 - (5 * E6) / 256));

  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);

  const C1 = EP2 * cosPhi1 * cosPhi1;
  const T1 = tanPhi1 * tanPhi1;
  const N1 = WGS84_A / Math.sqrt(1 - E2 * sinPhi1 * sinPhi1);
  const R1 = (WGS84_A * (1 - E2)) / Math.pow(1 - E2 * sinPhi1 * sinPhi1, 1.5);
  const D = x / (N1 * K0);

  const lat =
    phi1 -
    ((N1 * tanPhi1) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6) / 720);

  const lon =
    LON0_RAD +
    (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5) / 120) /
      cosPhi1;

  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}
