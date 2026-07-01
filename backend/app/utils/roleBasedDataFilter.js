import { getDateRangeFilter } from "./dateFilterHelper.js";

/**
 * Filter query based on user role
 * Automatically applies date filters for sellers
 */
export const applyRoleBasedFilter = (baseQuery, userRole) => {
  const dateFilter = getDateRangeFilter(userRole);
  
  // Merge with base query
  const finalQuery = {
    ...baseQuery,
    ...dateFilter
  };
  
  console.log("🔍 Final query with role-based filter:", finalQuery);
  return finalQuery;
};

/**
 * Get data access info for response
 */
export const getDataAccessInfo = (userRole) => {
  return {
    role: userRole,
    dataRange: getDateRangeLabel(userRole),
    lastUpdated: new Date()
  };
};

// Helper function
function getDateRangeLabel(userRole) {
  if (userRole === "admin") {
    return "All time";
  }
  if (userRole === "seller") {
    return "Last 40 days";
  }
  return "All time";
}
