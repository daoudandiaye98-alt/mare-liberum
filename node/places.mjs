// Mare Liberum · places: the centre of each country (rounded, for a map of 2° dots) and which domain endings name a country.
// Endings used worldwide as generic names (.io, .ai, .co, .me, .tv …) name no country and are never placed.

export const CENTROID = {
  AD: [42.5, 1.5], AE: [24, 54], AF: [33, 66], AL: [41, 20], AM: [40, 45], AO: [-12.5, 18.5], AR: [-34, -64], AT: [47.3, 13.3], AU: [-25, 134], AZ: [40.5, 47.5],
  BA: [44, 18], BB: [13.2, -59.5], BD: [24, 90], BE: [50.8, 4.5], BG: [43, 25], BH: [26, 50.5], BO: [-17, -65], BR: [-10, -52], BS: [24.3, -76], BW: [-22, 24], BY: [53, 28], BZ: [17.2, -88.7],
  CA: [56, -106], CH: [47, 8], CI: [7.5, -5.5], CL: [-30, -71], CM: [6, 12], CN: [35, 103], CR: [10, -84], CU: [21.5, -80], CY: [35, 33], CZ: [49.8, 15.5],
  DE: [51, 10], DK: [56, 10], DO: [19, -70.7], DZ: [28, 3], EC: [-2, -77.5], EE: [59, 26], EG: [27, 30], ES: [40, -4], ET: [8, 38],
  FI: [64, 26], FO: [62, -7], FR: [46, 2], GB: [54, -2], GE: [42, 43.5], GH: [8, -1.2], GR: [39, 22], GT: [15.5, -90.3],
  HK: [22.3, 114.2], HN: [15, -86.5], HR: [45.2, 15.5], HT: [19, -72.3], HU: [47, 20], ID: [-2, 118], IE: [53, -8], IL: [31.5, 34.8], IN: [21, 78], IQ: [33, 44], IR: [32, 53], IS: [65, -18], IT: [42.8, 12.8],
  JM: [18.1, -77.3], JO: [31, 36], JP: [36, 138], KE: [0.5, 38], KG: [41, 75], KH: [13, 105], KR: [36.5, 127.9], KW: [29.3, 47.6], KZ: [48, 68],
  LA: [18, 105], LB: [33.8, 35.8], LI: [47.2, 9.6], LK: [7.9, 80.7], LT: [55.9, 24], LU: [49.8, 6.1], LV: [57, 25], LY: [27, 17],
  MA: [32, -5], MC: [43.7, 7.4], MD: [47, 29], MG: [-20, 47], MK: [41.6, 21.7], MM: [21, 96], MN: [46, 105], MT: [35.9, 14.4], MU: [-20.3, 57.6], MX: [23, -102], MY: [4, 102], MZ: [-18, 35],
  NA: [-22, 17], NG: [9, 8], NI: [13, -85], NL: [52.3, 5.5], NO: [62, 10], NP: [28, 84], NZ: [-41, 174], OM: [21, 57],
  PA: [9, -80], PE: [-10, -76], PH: [13, 122], PK: [30, 70], PL: [52, 20], PR: [18.2, -66.5], PS: [31.9, 35.2], PT: [39.5, -8], PY: [-23, -58], QA: [25.5, 51.3],
  RO: [46, 25], RS: [44, 21], RU: [60, 100], RW: [-2, 30], SA: [25, 45], SD: [15, 30], SE: [62, 15], SG: [1.35, 103.8], SI: [46.1, 15], SK: [48.7, 19.5], SM: [43.9, 12.5], SN: [14, -14], SV: [13.8, -88.9], SY: [35, 38],
  TH: [15, 100], TN: [34, 9], TR: [39, 35], TT: [10.5, -61.3], TW: [23.5, 121], TZ: [-6, 35], UA: [49, 32], UG: [1, 32], US: [39, -98], UY: [-33, -56], UZ: [41, 64],
  VE: [8, -66], VN: [16, 106], YE: [15.5, 48], ZA: [-29, 24], ZM: [-15, 30], ZW: [-19, 29.5],
};
const GENERIC = new Set(['io', 'ai', 'co', 'me', 'tv', 'cc', 'fm', 'sh', 'ly', 'gg', 'to', 'ws', 'la', 'so', 'ac', 'im', 'sc', 'vc', 'gl', 'ms', 'nu', 'tk', 'ml', 'ga', 'cf', 'gq', 'ag', 'gs', 'tf', 'pw', 'cx', 'st', 'sx', 'md', 'as', 'cd', 'fy', 'eu']);
const ALIAS = { uk: 'GB' };
// the country a domain names by its ending, or null
export function tldCountry(host) {
  const t = String(host || '').toLowerCase().replace(/\.$/, '').split('.').pop();
  if (!t || t.length !== 2 || GENERIC.has(t)) return null;
  const cc = ALIAS[t] || t.toUpperCase();
  return CENTROID[cc] ? cc : null;
}
