const Role = require("../models/Role");

/**
 * NOTE: unused scaffolding. Nothing currently imports requirePermission —
 * every route is gated by the coarser requireRole()/adminOnly instead, and
 * there is no admin-panel screen for editing Role.permissions. This was
 * built ahead of the feature that would wire it up. Deciding which
 * permission maps to which route is a product/security decision that needs
 * sign-off before this gets connected, and the Role Management UI to edit
 * permissions is a separate scoped feature — don't assume this is enforced
 * just because it exists, and don't wire it up piecemeal without that
 * decision being made explicitly.
 */

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
