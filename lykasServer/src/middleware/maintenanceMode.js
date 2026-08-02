const FeatureFlag = require("../models/FeatureFlag");

const EXEMPT_PATHS = ["/health", "/api/system/health", "/api/system/version", "/api/auth/login"];

async function maintenanceMode(req, res, next) {
  try {
    if (EXEMPT_PATHS.includes(req.path)) return next();

    const flag = await FeatureFlag.findOne({ key: "maintenance_mode" });
    if (flag?.enabled) {
      return res.status(503).json({ success: false, message: "CarePaws is temporarily down for maintenance" });
    }
    next();
  } catch {
    // If the flag lookup itself fails, don't take the whole API down with it.
    next();
  }
}

module.exports = maintenanceMode;
