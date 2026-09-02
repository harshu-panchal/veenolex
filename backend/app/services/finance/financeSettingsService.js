import Setting from "../../models/setting.js";
import {
  DELIVERY_PRICING_MODE,
  HANDLING_FEE_STRATEGY,
} from "../../constants/finance.js";
import { roundCurrency } from "../../utils/money.js";

const DEFAULT_FINANCE_SETTINGS = {
  deliveryPricingMode: DELIVERY_PRICING_MODE.DISTANCE_BASED,
  customerBaseDeliveryFee: 30,
  riderBasePayout: 30,
  baseDistanceCapacityKm: 0.5,
  incrementalKmSurcharge: 10,
  deliveryPartnerRatePerKm: 5,
  fixedDeliveryFee: 30,
  handlingFeeStrategy: HANDLING_FEE_STRATEGY.HIGHEST_CATEGORY_FEE,
  codEnabled: true,
  onlineEnabled: true,
};

/** Settings that carry two historical field names for the same value. */
const ALIAS_GROUPS = [
  ["deliveryPricingMode", "pricingMode"],
  ["customerBaseDeliveryFee", "baseDeliveryCharge"],
  ["deliveryPartnerRatePerKm", "fleetCommissionRatePerKm"],
];

export function normalizeFinanceSettings(raw = {}) {
  const deliveryPricingMode =
    raw.deliveryPricingMode ||
    raw.pricingMode ||
    DEFAULT_FINANCE_SETTINGS.deliveryPricingMode;

  const customerBaseDeliveryFee = roundCurrency(
    raw.customerBaseDeliveryFee ?? raw.baseDeliveryCharge ?? DEFAULT_FINANCE_SETTINGS.customerBaseDeliveryFee,
  );

  const riderBasePayout = roundCurrency(
    raw.riderBasePayout ?? raw.baseDeliveryCharge ?? DEFAULT_FINANCE_SETTINGS.riderBasePayout,
  );

  const deliveryPartnerRatePerKm = roundCurrency(
    raw.deliveryPartnerRatePerKm ??
      raw.fleetCommissionRatePerKm ??
      DEFAULT_FINANCE_SETTINGS.deliveryPartnerRatePerKm,
  );

  const baseDistanceCapacityKm = Number(
    raw.baseDistanceCapacityKm ?? DEFAULT_FINANCE_SETTINGS.baseDistanceCapacityKm,
  );

  const incrementalKmSurcharge = roundCurrency(
    raw.incrementalKmSurcharge ?? DEFAULT_FINANCE_SETTINGS.incrementalKmSurcharge,
  );

  const fixedDeliveryFee = roundCurrency(
    raw.fixedDeliveryFee ?? raw.baseDeliveryCharge ?? customerBaseDeliveryFee,
  );

  const handlingFeeStrategy =
    raw.handlingFeeStrategy || DEFAULT_FINANCE_SETTINGS.handlingFeeStrategy;

  const platformFee = roundCurrency(raw.platformFee ?? 0);
  const freeDeliveryThreshold = roundCurrency(raw.freeDeliveryThreshold ?? 0);

  return {
    deliveryPricingMode,
    pricingMode: deliveryPricingMode,
    customerBaseDeliveryFee,
    riderBasePayout,
    baseDeliveryCharge: customerBaseDeliveryFee,
    baseDistanceCapacityKm: Number.isFinite(baseDistanceCapacityKm)
      ? Math.max(baseDistanceCapacityKm, 0)
      : DEFAULT_FINANCE_SETTINGS.baseDistanceCapacityKm,
    incrementalKmSurcharge,
    deliveryPartnerRatePerKm,
    fleetCommissionRatePerKm: deliveryPartnerRatePerKm,
    fixedDeliveryFee,
    handlingFeeStrategy,
    platformFee,
    freeDeliveryThreshold,
    codEnabled: raw.codEnabled ?? DEFAULT_FINANCE_SETTINGS.codEnabled,
    onlineEnabled: raw.onlineEnabled ?? DEFAULT_FINANCE_SETTINGS.onlineEnabled,
  };
}

export async function getOrCreateFinanceSettings({ session } = {}) {
  const query = {};
  const options = session ? { session } : {};
  let settings = await Setting.findOne(query, null, options);

  if (!settings) {
    settings = await Setting.create(
      {
        ...DEFAULT_FINANCE_SETTINGS,
        pricingMode: DEFAULT_FINANCE_SETTINGS.deliveryPricingMode,
        baseDeliveryCharge: DEFAULT_FINANCE_SETTINGS.customerBaseDeliveryFee,
        fleetCommissionRatePerKm: DEFAULT_FINANCE_SETTINGS.deliveryPartnerRatePerKm,
      },
      options,
    );
  }

  return normalizeFinanceSettings(settings.toObject?.() || settings);
}

/**
 * Applies a (possibly partial) finance payload on top of what is stored.
 *
 * `normalizeFinanceSettings` fills every missing key from
 * DEFAULT_FINANCE_SETTINGS, so normalizing the raw payload alone would
 * silently reset any field the caller did not send — e.g. saving only
 * `returnDeliveryCommission` would knock `riderBasePayout` back to 30.
 * Merging against the current document first keeps partial saves safe.
 */
export async function updateDeliveryFinanceSettings(payload, { session } = {}) {
  const query = {};
  const findOptions = session ? { session } : {};
  const current = await Setting.findOne(query, null, findOptions);
  const currentPlain = current?.toObject?.() || current || {};

  const merged = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (value !== undefined) merged[key] = value;
  }

  // Several settings have two historical names. When the payload sets one
  // of them, the stored value of its alias must not shadow it — normalize
  // resolves aliases by precedence, not recency.
  const base = { ...currentPlain };
  for (const aliases of ALIAS_GROUPS) {
    if (!aliases.some((key) => key in merged)) continue;
    for (const key of aliases) {
      if (!(key in merged)) delete base[key];
    }
  }

  const normalized = normalizeFinanceSettings({ ...base, ...merged });

  const options = { upsert: true, new: true };
  if (session) options.session = session;

  const updated = await Setting.findOneAndUpdate(query, { $set: normalized }, options);
  return normalizeFinanceSettings(updated.toObject?.() || updated);
}

export { DEFAULT_FINANCE_SETTINGS };
