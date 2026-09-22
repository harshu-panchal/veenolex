import Joi from "joi";

export const sendSignupOtpSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  phone: Joi.string().trim().min(7).max(24).required(),
});

export const sendLoginOtpSchema = Joi.object({
  phone: Joi.string().trim().min(7).max(24).required(),
});

// Customer's app delivery location (coarse: city/state/pincode + coordinates).
export const appLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  address: Joi.string().trim().max(300).allow(""),
  city: Joi.string().trim().max(100).allow(""),
  state: Joi.string().trim().max(100).allow(""),
  pincode: Joi.string().trim().max(12).allow(""),
});

export const updateLastLocationSchema = Joi.object({
  location: appLocationSchema.required(),
});

export const verifyOtpSchema = Joi.object({
  phone: Joi.string().trim().min(7).max(24).required(),
  otp: Joi.string().trim().pattern(/^\d{4,8}$/).required(),
  // Optional app location at login time; never required for login to succeed.
  location: appLocationSchema.optional(),
});

export function validateSchema(schema, payload) {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (!error) return value;
  const err = new Error(error.details.map((item) => item.message).join("; "));
  err.statusCode = 400;
  throw err;
}
