/**
 * apiHelpers.js
 * Safe utility functions for consistent API response handling.
 */

/**
 * Normalizes an axios API response to extract the actual data payload.
 * Handles:
 *   { data: { data: [...] } }   ← paginated
 *   { data: { data: {...} } }   ← single object
 *   { data: { ... } }           ← direct object/array in data
 */
export const normalizeAPIResponse = (res) => {
  if (!res) return null;
  // Paginated / nested:  res.data.data
  if (res?.data?.data !== undefined) return res.data.data;
  // Direct payload:      res.data
  if (res?.data !== undefined) return res.data;
  return null;
};

/**
 * Normalises a response and always returns an array.
 * Use this for list endpoints only.
 */
export const normalizeToArray = (res) => {
  const data = res?.data?.data || res?.data || [];
  return Array.isArray(data) ? data : [];
};

/**
 * Ensures value is an array — prevents .map() crashes.
 */
export const ensureArray = (data) => (Array.isArray(data) ? data : []);

/**
 * Safe number with a fallback.
 */
export const safeNumber = (val, fallback = 0) => {
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

/**
 * Returns fine amount regardless of field name.
 */
export const getFineAmount = (fine) => {
  if (!fine) return 0;
  return safeNumber(fine.fineAmount ?? fine.amount ?? fine.calculatedAmount ?? 0);
};

/**
 * Normalises status strings for consistent comparisons.
 */
export const normalizeStatus = (status) => {
  if (!status) return '';
  return status.toString().trim().toLowerCase();
};
