const { Event, EventRegistration, EventVolunteerAssignment } = require("../models/Event");

async function myRegistrations(req, res, next) {
  try {
    const data = await EventRegistration.find({ user: req.user._id }).populate("event").sort({ registeredAt: -1 });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const event = await Event.create({ ...req.body, createdBy: req.user._id });
    return res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    const events = await Event.find(filter).sort({ date: 1 });
    return res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    return res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    return res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    if (event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
      return res.status(409).json({ success: false, message: "Event is full" });
    }

    const existing = await EventRegistration.findOne({ event: event._id, user: req.user._id, status: { $ne: "cancelled" } });
    if (existing) return res.status(409).json({ success: false, message: "Already registered" });

    const registration = await EventRegistration.create({ event: event._id, user: req.user._id });
    event.currentAttendees += 1;
    await event.save();

    return res.status(201).json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
}

async function unregister(req, res, next) {
  try {
    const registration = await EventRegistration.findOneAndUpdate(
      { event: req.params.id, user: req.user._id },
      { status: "cancelled" },
      { new: true }
    );
    if (!registration) return res.status(404).json({ success: false, message: "Registration not found" });

    await Event.findByIdAndUpdate(req.params.id, { $inc: { currentAttendees: -1 } });

    return res.json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
}

async function listRegistrations(req, res, next) {
  try {
    const data = await EventRegistration.find({ event: req.params.id }).populate("user", "displayName email");
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function markAttended(req, res, next) {
  try {
    const registration = await EventRegistration.findOneAndUpdate(
      { event: req.params.id, user: req.params.userId },
      { status: "attended" },
      { new: true }
    );
    if (!registration) return res.status(404).json({ success: false, message: "Registration not found" });
    return res.json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
}

async function assignVolunteer(req, res, next) {
  try {
    const assignment = await EventVolunteerAssignment.create({
      event: req.params.id,
      volunteer: req.body.volunteer,
      role: req.body.role,
      assignedBy: req.user._id,
    });
    return res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
}

async function listVolunteerAssignments(req, res, next) {
  try {
    const data = await EventVolunteerAssignment.find({ event: req.params.id }).populate("volunteer");
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateVolunteerAssignment(req, res, next) {
  try {
    const assignment = await EventVolunteerAssignment.findByIdAndUpdate(req.params.assignmentId, req.body, { new: true });
    if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });
    return res.json({ success: true, data: assignment });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  myRegistrations,
  create,
  list,
  getOne,
  update,
  remove,
  register,
  unregister,
  listRegistrations,
  markAttended,
  assignVolunteer,
  listVolunteerAssignments,
  updateVolunteerAssignment,
};
