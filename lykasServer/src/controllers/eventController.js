const { Event, EventRegistration, EventVolunteerAssignment } = require("../models/Event");
const Volunteer = require("../models/Volunteer");
const { notifyOnce } = require("../utils/notificationHelper");

function activeRegistrationFilter() {
  return { status: { $in: ["registered", "attended"] } };
}

async function myRegistrations(req, res, next) {
  try {
    const data = await EventRegistration.find({ user: req.user._id })
      .populate("event")
      .sort({ registeredAt: -1 });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const payload = { ...req.body, createdBy: req.user._id };
    if (payload.endDate && new Date(payload.endDate) <= new Date(payload.date)) {
      return res.status(400).json({ success: false, message: "Event end date must be after its start date" });
    }
    const event = await Event.create(payload);
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
    const existing = await Event.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Event not found" });

    const nextStart = req.body.date ? new Date(req.body.date) : existing.date;
    const nextEnd = req.body.endDate ? new Date(req.body.endDate) : existing.endDate;
    if (nextEnd && nextEnd <= nextStart) {
      return res.status(400).json({ success: false, message: "Event end date must be after its start date" });
    }

    if (req.body.maxAttendees !== undefined && req.body.maxAttendees < existing.currentAttendees) {
      return res.status(409).json({ success: false, message: "Capacity cannot be below the current attendee count" });
    }

    const event = await Event.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    return res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    // Keep registrations and attendance history. Cancellation is the persisted
    // event lifecycle state rather than a destructive delete.
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "cancelled" } },
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    return res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const eventId = req.params.id;
    const userId = req.user._id;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    if (event.status === "cancelled" || event.status === "completed") {
      return res.status(409).json({ success: false, message: "Event is not accepting registrations" });
    }

    const active = await EventRegistration.findOne({
      event: eventId,
      user: userId,
      ...activeRegistrationFilter(),
    });
    if (active) return res.status(409).json({ success: false, message: "Already registered" });

    // Reserve a capacity slot atomically before writing the registration. If two
    // requests arrive together, MongoDB permits only the requests that can
    // increment the available capacity.
    const capacityFilter =
      event.maxAttendees == null
        ? { _id: eventId, status: { $nin: ["cancelled", "completed"] } }
        : {
            _id: eventId,
            status: { $nin: ["cancelled", "completed"] },
            $expr: { $lt: ["$currentAttendees", "$maxAttendees"] },
          };

    const reservedEvent = await Event.findOneAndUpdate(
      capacityFilter,
      { $inc: { currentAttendees: 1 } },
      { new: true }
    );

    if (!reservedEvent) {
      return res.status(409).json({ success: false, message: "Event is full" });
    }

    let registration;
    try {
      const cancelled = await EventRegistration.findOneAndUpdate(
        { event: eventId, user: userId, status: "cancelled" },
        { $set: { status: "registered", registeredAt: new Date() } },
        { new: true }
      );

      registration = cancelled || (await EventRegistration.create({ event: eventId, user: userId }));
    } catch (err) {
      // A concurrent registration may have won the unique active-registration
      // constraint. Return the reserved capacity to the event.
      await Event.findOneAndUpdate({ _id: eventId, currentAttendees: { $gt: 0 } }, { $inc: { currentAttendees: -1 } });
      if (err?.code === 11000) {
        return res.status(409).json({ success: false, message: "Already registered" });
      }
      throw err;
    }

    await notifyOnce({
      recipient: userId,
      type: "EVENT_REGISTRATION",
      title: "Event registration confirmed",
      message: `You're registered for ${reservedEvent.title} on ${new Date(reservedEvent.date).toLocaleString()}.`,
      refModel: "Event",
      refId: reservedEvent._id,
      dedupeKey: `event-registration:${registration._id}`,
    });

    return res.status(201).json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
}

async function unregister(req, res, next) {
  try {
    const registration = await EventRegistration.findOneAndUpdate(
      { event: req.params.id, user: req.user._id, status: "registered" },
      { $set: { status: "cancelled" } },
      { new: true }
    );
    if (!registration) return res.status(404).json({ success: false, message: "Active registration not found" });

    await Event.findOneAndUpdate(
      { _id: req.params.id, currentAttendees: { $gt: 0 } },
      { $inc: { currentAttendees: -1 } }
    );

    return res.json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
}

async function listRegistrations(req, res, next) {
  try {
    const data = await EventRegistration.find({ event: req.params.id })
      .populate("user", "displayName email")
      .sort({ registeredAt: 1 });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function markAttended(req, res, next) {
  try {
    const registration = await EventRegistration.findOneAndUpdate(
      { event: req.params.id, user: req.params.userId, status: "registered" },
      { $set: { status: "attended" } },
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
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    if (event.status === "cancelled") return res.status(409).json({ success: false, message: "Cannot assign volunteers to a cancelled event" });

    const volunteer = await Volunteer.findOne({ _id: req.body.volunteer, isDeleted: { $ne: true } });
    if (!volunteer) return res.status(404).json({ success: false, message: "Volunteer not found" });

    // Do not create duplicate assignments for the same volunteer/event.
    const existing = await EventVolunteerAssignment.findOne({ event: event._id, volunteer: volunteer._id });
    if (existing && existing.status !== "cancelled") {
      return res.status(409).json({ success: false, message: "Volunteer is already assigned to this event" });
    }

    const assignment = existing
      ? await EventVolunteerAssignment.findByIdAndUpdate(
          existing._id,
          { $set: { role: req.body.role, assignedBy: req.user._id, status: "assigned" } },
          { new: true, runValidators: true }
        )
      : await EventVolunteerAssignment.create({
          event: event._id,
          volunteer: volunteer._id,
          role: req.body.role,
          assignedBy: req.user._id,
        });

    if (volunteer.user) {
      await notifyOnce({
        recipient: volunteer.user,
        sender: req.user._id,
        type: "VOLUNTEER_SHIFT",
        title: "Volunteer shift assigned",
        message: `You've been assigned to ${event.title}${event.date ? ` on ${new Date(event.date).toLocaleString()}` : ""}.`,
        refModel: "Event",
        refId: assignment.event,
        dedupeKey: `volunteer-shift:${assignment._id}:assigned`,
      });
    }
    return res.status(existing ? 200 : 201).json({ success: true, data: assignment });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ success: false, message: "Volunteer is already assigned to this event" });
    next(err);
  }
}

async function listVolunteerAssignments(req, res, next) {
  try {
    const data = await EventVolunteerAssignment.find({ event: req.params.id }).populate("volunteer").sort({ createdAt: 1 });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateVolunteerAssignment(req, res, next) {
  try {
    const existing = await EventVolunteerAssignment.findById(req.params.assignmentId);
    if (!existing) return res.status(404).json({ success: false, message: "Assignment not found" });
    const previousStatus = existing.status;
    const assignment = await EventVolunteerAssignment.findByIdAndUpdate(
      req.params.assignmentId,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (req.body.status && req.body.status !== previousStatus) {
      const volunteer = await Volunteer.findById(assignment.volunteer).select("user");
      if (volunteer?.user) {
        await notifyOnce({
          recipient: volunteer.user,
          sender: req.user._id,
          type: "VOLUNTEER_SHIFT",
          title: "Volunteer shift updated",
          message: `Your volunteer shift status is now ${assignment.status}.`,
          refModel: "Event",
          refId: assignment.event,
          dedupeKey: `volunteer-shift:${assignment._id}:${assignment.status}`,
        });
      }
    }
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
