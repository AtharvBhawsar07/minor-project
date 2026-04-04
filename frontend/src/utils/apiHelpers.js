/**
 * apiHelpers.js
 * Centralized utility functions for consistent API response handling and safe data access.
 */

/**
 * Normalizes API responses to extract the actual data.
 * Handles multiple response structures:
 * - { success: true, data: [...] }
 * - { success: true, data: { data: [...] } }
 * - { data: [...] }
 * - Direct array/object
 */
export const normalizeAPIResponse = (res) => {
  if (!res) return null;
  
  // Handle axios response structure
  if (res.data) {
    // Handle { success: true, data: { data: [...] } }
    if (res.data.success !== undefined && res.data.data !== undefined && typeof res.data.data === 'object') {
      return res.data.data.data || res.data.data;
    }
    // Handle { success: true, data: [...] }
    if (res.data.success !== undefined && res.data.data !== undefined) {
      return res.data.data;
    }
    // Handle { data: [...] }
    if (res.data.data !== undefined) {
      return res.data.data;
    }
    // Handle direct data
    return res.data;
  }
  
  // Handle direct response
  return res;
};

/**
 * Enhanced normalize function that always returns an array
 */
export const normalizeToArray = (res) => {
  const data = normalizeAPIResponse(res);
  return Array.isArray(data) ? data : [];
};

/**
 * Ensures the input is an array, providing a fallback to an empty array.
 * Prevents .map() and .filter() errors.
 */
export const ensureArray = (data) => {
  return Array.isArray(data) ? data : [];
};

/**
 * Ensures the input is a valid number, providing a fallback.
 */
export const safeNumber = (val, fallback = 0) => {
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

/**
 * Returns the fine amount regardless of whether the field is "fineAmount" or "amount".
 */
export const getFineAmount = (fine) => {
  if (!fine) return 0;
  return safeNumber(fine.fineAmount ?? fine.amount ?? 0);
};

/**
 * Normalizes status strings for consistent comparisons.
 */
export const normalizeStatus = (status) => {
  if (!status) return '';
  return status.toString().trim().toLowerCase();
};
