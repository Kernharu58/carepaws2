const User = require("../../src/models/User");

describe("User account lockout", () => {
  it("hashes the password on save and never stores plaintext", async () => {
    const user = await User.create({ displayName: "Ana", email: "ana@example.com", password: "plaintext123" });
    const stored = await User.findById(user._id).select("+password");
    expect(stored.password).not.toBe("plaintext123");
    expect(await stored.comparePassword("plaintext123")).toBe(true);
    expect(await stored.comparePassword("wrongpass")).toBe(false);
  });

  it("isLocked() is false when status is active", async () => {
    const user = await User.create({ displayName: "Ben", email: "ben@example.com", password: "password123" });
    expect(user.isLocked()).toBe(false);
  });

  it("isLocked() is true when status is locked and lockedUntil is in the future", async () => {
    const user = await User.create({
      displayName: "Cara",
      email: "cara@example.com",
      password: "password123",
      status: "locked",
      lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
    });
    expect(user.isLocked()).toBe(true);
  });

  it("isLocked() is false once lockedUntil has passed, even if status wasn't reset yet", async () => {
    const user = await User.create({
      displayName: "Dan",
      email: "dan@example.com",
      password: "password123",
      status: "locked",
      lockedUntil: new Date(Date.now() - 1000),
    });
    expect(user.isLocked()).toBe(false);
  });
});
