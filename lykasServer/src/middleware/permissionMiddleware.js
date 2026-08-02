const Role = require("../models/Role");

/**
 * Fine-grained, admin-configurable permission check layered on top of the
 * coarse role enum. super_admin always short-circuits to allowed; every
 * other role is checked against its Role document's permissions array,
 * where the literal string "*" grants all permissions (§5.1).
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
      if (req.user.role === "super_admin") return next();

      const role = await Role.findOne({ key: req.user.role });
      if (!role) return res.status(403).json({ success: false, message: "No permissions configured for this role" });

      if (role.permissions.includes("*") || role.permissions.includes(permission)) {
        return next();
      }

      return res.status(403).json({ success: false, message: `Missing permission: ${permission}` });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePermission };
