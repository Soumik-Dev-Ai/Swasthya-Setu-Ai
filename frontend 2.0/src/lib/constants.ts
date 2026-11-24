/* Static UI reference data with no backend/pipeline dependency.
 * (Formerly scattered inside the mock `data.ts`, now the only survivors.) */

// Map-centre anchor for the very first render (before geolocation resolves).
export const USER_LOCATION = { lat: 26.9124, lng: 75.7873 }; // Jaipur city centre

// Full state/UT names (7A: all 28 states + 8 UTs). The backend's scheme
// matcher expects a 2-letter code; the mapping lives in Insurance.tsx
// (STATE_CODES), not here — the two lists must stay in lockstep.
export const STATES = [
  // States (28)
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
  // Union Territories (8)
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];