import { getDateRangeFilter } from "../utils/dateFilterHelper.js";

/**
 * Middleware to attach date filter to request
 * based on user role
 */
export const attachRoleDateFilter = (req, res, next) => {
  try {
    const userRole = req.user?.role || "user";
    
    // Get date filter based on role
    const dateFilter = getDateRangeFilter(userRole);
    
    // Attach to request object
    req.dateFilter = dateFilter;
    req.userRole = userRole;
    
    console.log(`\uD83D\uDD10 User role: ${userRole}, Date filter attached`);
    
    next();
  } catch (error) {
    console.error("Error in role date filter middleware:", error);
    next(error);
  }
};
