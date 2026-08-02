const cloudinary = require("../config/cloudinary");
const UserDocument = require("../models/UserDocument");

function uploadBufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "auto" }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

async function myDocuments(req, res, next) {
  try {
    const data = await UserDocument.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function upload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const result = await uploadBufferToCloudinary(req.file.buffer, "carepaws/documents");

    const doc = await UserDocument.create({
      user: req.user._id,
      application: req.body.application || null,
      type: req.body.type,
      label: req.body.label,
      fileUrl: result.secure_url,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const doc = await UserDocument.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    const data = await UserDocument.find(filter).populate("user", "displayName email").sort({ createdAt: -1 });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const doc = await UserDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

    doc.status = req.body.status;
    doc.verifiedBy = req.user._id;
    doc.verifiedAt = new Date();
    doc.rejectedReason = req.body.rejectedReason;
    await doc.save();

    return res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

module.exports = { myDocuments, upload, remove, list, verify };
