const express = require("express");
const router = express.Router();
const Role = require("../models/Role");
const { protect, requireRole } = require("../middleware/authMiddleware");

router.get("/", protect, requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const roles = await Role.find();
    res.json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
});

router.post("/", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const role = await Role.create(req.body);
    res.status(201).json({ success: true, data: role });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: "Role not found" });
    if (role.isSystem && req.body.key && req.body.key !== role.key) {
      return res.status(403).json({ success: false, message: "Cannot rename a system role" });
    }
    Object.assign(role, req.body);
    await role.save();
    res.json({ success: true, data: role });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", protect, requireRole("super_admin"), async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: "Role not found" });
    if (role.isSystem) return res.status(403).json({ success: false, message: "Cannot delete a system role" });
    await role.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
