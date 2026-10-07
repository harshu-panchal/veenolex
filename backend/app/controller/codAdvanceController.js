import Joi from "joi";
import handleResponse from "../utils/helper.js";
import { validateBody as validateWithJoi } from "../middleware/validate.js";
import {
  decideCodAdvance,
  listPendingCodAdvanceDecisions,
} from "../services/codAdvanceService.js";

const decisionSchema = Joi.object({
  action: Joi.string().valid("REFUND", "KEEP").required(),
  note: Joi.string().allow("").max(500).optional(),
});

function actorFromRequest(req) {
  return { role: req.user?.role === "admin" ? "admin" : "seller", id: req.user?.id };
}

export const getPendingCodAdvanceDecisions = async (req, res) => {
  try {
    const orders = await listPendingCodAdvanceDecisions(actorFromRequest(req));
    return handleResponse(res, 200, "Pending COD advance decisions", orders);
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};

export const submitCodAdvanceDecision = async (req, res) => {
  try {
    const payload = validateWithJoi(decisionSchema, req.body || {});
    const order = await decideCodAdvance({
      orderId: req.params.orderId,
      action: payload.action,
      note: payload.note,
      actor: actorFromRequest(req),
    });
    const message =
      payload.action === "REFUND"
        ? "Advance refund sent to the customer's payment method"
        : "Advance retained";
    return handleResponse(res, 200, message, {
      orderId: order.orderId,
      codAdvance: order.codAdvance,
    });
  } catch (error) {
    return handleResponse(res, error.statusCode || 500, error.message);
  }
};
