const { ARCHIVABLE_COLLECTIONS, resolveArchivableModel } = require("../../src/routes/archiveRoutes");

describe("Archive allowlist resolution (pure logic — no HTTP, no DB queries)", () => {
  afterEach(() => {
    // Guard against any test in this file leaving the shared, exported
    // Map mutated for whichever test runs next.
    ARCHIVABLE_COLLECTIONS.clear();
  });

  it("ships empty in production code — no entity is currently approved for generic archiving", () => {
    expect(ARCHIVABLE_COLLECTIONS.size).toBe(0);
  });

  it("resolves nothing for a real, sensitive model name that was never explicitly added", () => {
    expect(resolveArchivableModel("User")).toBeNull();
    expect(resolveArchivableModel("Payment")).toBeNull();
    expect(resolveArchivableModel("TokenBlacklist")).toBeNull();
    expect(resolveArchivableModel("ApiKey")).toBeNull();
    expect(resolveArchivableModel("Role")).toBeNull();
    expect(resolveArchivableModel("AuditLog")).toBeNull();
    expect(resolveArchivableModel("AnythingAtAll")).toBeNull();
  });

  it("regression: does not resolve via the Object/prototype chain the way a plain-object lookup would", () => {
    // A naive `SOME_OBJECT[userInput]` lookup can return a real,
    // non-null value for these keys even when nothing was ever
    // explicitly assigned. A Map cannot do that — Map#get only ever
    // returns what was set with Map#set.
    expect(resolveArchivableModel("constructor")).toBeNull();
    expect(resolveArchivableModel("__proto__")).toBeNull();
    expect(resolveArchivableModel("prototype")).toBeNull();
    expect(resolveArchivableModel("hasOwnProperty")).toBeNull();
    expect(resolveArchivableModel("toString")).toBeNull();
  });

  it("rejects non-string input rather than throwing", () => {
    expect(resolveArchivableModel(undefined)).toBeNull();
    expect(resolveArchivableModel(null)).toBeNull();
    expect(resolveArchivableModel(42)).toBeNull();
    expect(resolveArchivableModel({})).toBeNull();
    expect(resolveArchivableModel(["User"])).toBeNull();
  });

  it("resolves exactly what was explicitly added, once added, and is case-sensitive", () => {
    function FakeModel() {}
    ARCHIVABLE_COLLECTIONS.set("FakeModel", FakeModel);

    expect(resolveArchivableModel("FakeModel")).toBe(FakeModel);
    expect(resolveArchivableModel("fakemodel")).toBeNull();
    expect(resolveArchivableModel("FAKEMODEL")).toBeNull();
  });

  it("stops resolving something that was added, once removed", () => {
    function FakeModel() {}
    ARCHIVABLE_COLLECTIONS.set("FakeModel", FakeModel);
    expect(resolveArchivableModel("FakeModel")).toBe(FakeModel);

    ARCHIVABLE_COLLECTIONS.delete("FakeModel");
    expect(resolveArchivableModel("FakeModel")).toBeNull();
  });
});
