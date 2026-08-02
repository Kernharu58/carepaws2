const { verifyAccessToken } = require("../utils/tokens");
const TokenBlacklist = require("../models/TokenBlacklist");
const User = require("../models/User");

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const blacklisted = await TokenBlacklist.findOne({ token });
    if (blacklisted) {
      return res.status(401).json({ success: false, message: "Token has been revoked" });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    const user = await User.findById(payload.id);
    if (!user || user.isDeleted) {
      return res.status(401).json({ success: false, message: "User no longer exists" });
    }
    if (user.status !== "active") {
      return res.status(403).json({ success: false, message: `Account is ${user.status}` });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
    if (req.user.role === "super_admin" || roles.includes(req.user.role)) return next();
    return res.status(403).json({ success: false, message: "Insufficient role" });
  };
}

const adminOnly = requireRole("staff", "admin", "super_admin");

module.exports = { protect, requireRole, adminOnly };
