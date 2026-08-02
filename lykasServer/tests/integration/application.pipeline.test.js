const request = require("supertest");

// See auth.flow.test.js for why this mock exists — Redis-backed rate
// limiting needs a real Redis instance, out of scope for these tests.
jest.mock("../../src/middleware/rateLimitMiddleware", () => ({
  globalLimiter: (req, res, next) => next(),
  loginLimiter: (req, res, next) => next(),
  registerLimiter: (req, res, next) => next(),
  passwordResetLimiter: (req, res, next) => next(),
  webhookLimiter: (req, res, next) => next(),
}));

const { app } = require("../../src/server");
const User = require("../../src/models/User");
const Pet = require("../../src/models/Pet");
const Application = require("../../src/models/Application");

async function registerAndLogin(email, role = "user") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ displayName: "Test " + role, email, password: "password123" });

  if (role !== "user") {
    await User.findOneAndUpdate({ email }, { role });
    // Log in again to get a token carrying the updated role.
    const loginRes = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    return { token: loginRes.body.data.accessToken, user: loginRes.body.data.user };
  }

  return { token: res.body.data.accessToken, user: res.body.data.user };
}

describe("Application pipeline: submit -> stage transitions -> approve/reject", () => {
  let applicantToken, staffToken, pet;

  beforeEach(async () => {
    const applicant = await registerAndLogin("applicant@example.com", "user");
    const staff = await registerAndLogin("staff@example.com", "staff");
    applicantToken = applicant.token;
    staffToken = staff.token;

    pet = await Pet.create({ name: "Bantay", species: "Dog", status: "Available" });
  });

  it("submits an application and moves the pet to Pending", async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ pet: pet._id.toString(), phone: "0917000000", address: "123 Main St" });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.stage).toBe("submitted");
    expect(res.body.data.stageHistory).toHaveLength(1);

    const updatedPet = await Pet.findById(pet._id);
    expect(updatedPet.status).toBe("Pending");
  });

  it("rejects a second application for a pet that's no longer Available", async () => {
    await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ pet: pet._id.toString(), phone: "0917000000", address: "123 Main St" });

    const second = await registerAndLogin("second@example.com", "user");
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${second.token}`)
      .send({ pet: pet._id.toString(), phone: "0917111111", address: "456 Side St" });

    expect(res.status).toBe(409);
  });

  it("staff can move an application through pipeline stages, recording stageHistory", async () => {
    const submitRes = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ pet: pet._id.toString(), phone: "0917000000", address: "123 Main St" });

    const appId = submitRes.body.data._id;

    const stages = ["document_review", "interview", "home_visit", "risk_assessment", "approved"];
    for (const stage of stages) {
      const res = await request(app)
        .put(`/api/applications/${appId}/stage`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ stage, note: `moved to ${stage}` });
      expect(res.status).toBe(200);
      expect(res.body.data.stage).toBe(stage);
    }

    const final = await Application.findById(appId);
    // 1 initial "submitted" entry from creation + 5 explicit transitions
    expect(final.stageHistory).toHaveLength(6);
  });

  it("approving an application marks the pet Adopted; rejecting frees it back to Available", async () => {
    const submitRes = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ pet: pet._id.toString(), phone: "0917000000", address: "123 Main St" });

    const appId = submitRes.body.data._id;

    const approveRes = await request(app)
      .put(`/api/applications/${appId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "approved" });

    expect(approveRes.status).toBe(200);
    expect((await Pet.findById(pet._id)).status).toBe("Adopted");

    // A separate pet/application to exercise the rejection path.
    const pet2 = await Pet.create({ name: "Luna", species: "Cat", status: "Available" });
    const submitRes2 = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ pet: pet2._id.toString(), phone: "0917000000", address: "123 Main St" });

    const rejectRes = await request(app)
      .put(`/api/applications/${submitRes2.body.data._id}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "rejected" });

    expect(rejectRes.status).toBe(200);
    expect((await Pet.findById(pet2._id)).status).toBe("Available");
  });

  it("a non-owner, non-staff user cannot view someone else's application", async () => {
    const submitRes = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ pet: pet._id.toString(), phone: "0917000000", address: "123 Main St" });

    const stranger = await registerAndLogin("stranger@example.com", "user");
    const res = await request(app)
      .get(`/api/applications/${submitRes.body.data._id}`)
      .set("Authorization", `Bearer ${stranger.token}`);

    expect(res.status).toBe(403);
  });

  it("internal notes are visible to staff but stripped from the applicant's view", async () => {
    const submitRes = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${applicantToken}`)
      .send({ pet: pet._id.toString(), phone: "0917000000", address: "123 Main St" });

    const appId = submitRes.body.data._id;

    await request(app)
      .post(`/api/applications/${appId}/notes`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ text: "Applicant seems well-prepared." });

    const asStaff = await request(app).get(`/api/applications/${appId}`).set("Authorization", `Bearer ${staffToken}`);
    expect(asStaff.body.data.internalNotes).toBeDefined();
    expect(asStaff.body.data.internalNotes.length).toBe(1);

    const asApplicant = await request(app).get(`/api/applications/${appId}`).set("Authorization", `Bearer ${applicantToken}`);
    expect(asApplicant.body.data.internalNotes).toBeUndefined();
  });
});
