/**
 * Get date range filter based on user role
 * Sellers: Last 40 days
 * Admins: All time
 */
export const getDateRangeFilter = (userRole) => {
  if (userRole === "admin") {
    // Admins see all data
    console.log("📊 Admin role: No date filter");
    return {};
  }
  
  if (userRole === "seller") {
    // Sellers see only last 40 days
    const fortyDaysAgo = new Date();
    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
    
    const filter = {
      createdAt: {
        $gte: fortyDaysAgo  // Greater than or equal to 40 days ago
      }
    };
    
    console.log("📊 Seller role: Filtering from", fortyDaysAgo, "to today");
    return filter;
  }
  
  // Default: no filter
  return {};
};

/**
 * Apply date filter to MongoDB query
 */
export const applyDateFilter = (query, userRole) => {
  const dateFilter = getDateRangeFilter(userRole);
  return { ...query, ...dateFilter };
};

/**
 * Get human-readable date range
 */
export const getDateRangeLabel = (userRole) => {
  if (userRole === "admin") {
    return "All time";
  }
  
  if (userRole === "seller") {
    return "Last 40 days";
  }
  
  return "All time";
};
