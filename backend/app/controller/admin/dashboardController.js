import handleResponse from "../../utils/helper.js";
import { getAdminDashboardStats } from "../../services/admin/dashboardService.js";

export const getAdminStats = async (req, res) => {
  try {
    const stats = await getAdminDashboardStats({
      from: req.query.from || req.query.date,
      to: req.query.to || req.query.date,
    });
    return handleResponse(res, 200, "Admin stats fetched successfully", stats);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
