import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import Seller from "../../models/seller.js";
import {
  approveSellerApplicationById,
  getPendingSellerApplications,
  rejectSellerApplicationById,
  getPendingPasswordResetRequestList,
  approveSellerPasswordResetById,
  rejectSellerPasswordResetById,
} from "../../services/admin/sellerApplicationService.js";

export const getPendingSellers = async (req, res) => {
  try {
    const { q = "", status = "pending" } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const data = await getPendingSellerApplications({
      q,
      status,
      page,
      limit,
      skip,
    });

    return handleResponse(res, 200, "Pending seller applications fetched", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const approveSellerApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await approveSellerApplicationById({
      sellerId: id,
      reviewedBy: req.user.id,
    });

    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    return handleResponse(res, 200, "Seller approved successfully", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const rejectSellerApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const seller = await rejectSellerApplicationById({
      sellerId: id,
      reviewedBy: req.user.id,
      reason,
    });

    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    return handleResponse(res, 200, "Seller application rejected", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateSellerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};

    const seller = await Seller.findByIdAndUpdate(
      id,
      { isActive: Boolean(isActive) },
      { new: true }
    ).select("-password");

    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    return handleResponse(
      res,
      200,
      `Seller status updated to ${seller.isActive ? "Active" : "Inactive"}`,
      seller
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   SELLER PASSWORD RESET APPROVALS
================================ */

export const getPendingPasswordResetRequests = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const data = await getPendingPasswordResetRequestList({
      q,
      page,
      limit,
      skip,
    });

    return handleResponse(res, 200, "Password reset requests fetched", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const approveSellerPasswordReset = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await approveSellerPasswordResetById({
      sellerId: id,
      reviewedBy: req.user.id,
    });

    if (result.notFound) {
      return handleResponse(res, 404, "Seller not found");
    }
    if (result.notPending) {
      return handleResponse(
        res,
        409,
        "No pending password reset request for this seller",
      );
    }

    return handleResponse(
      res,
      200,
      "Password reset request approved. The seller can now set their new password.",
      result.request,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const rejectSellerPasswordReset = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const result = await rejectSellerPasswordResetById({
      sellerId: id,
      reviewedBy: req.user.id,
      reason,
    });

    if (result.notFound) {
      return handleResponse(res, 404, "Seller not found");
    }
    if (result.notPending) {
      return handleResponse(
        res,
        409,
        "No pending password reset request for this seller",
      );
    }

    return handleResponse(
      res,
      200,
      "Password reset request rejected",
      result.request,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
