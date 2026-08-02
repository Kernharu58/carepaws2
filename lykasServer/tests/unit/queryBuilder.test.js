const { buildListQuery, buildSort, buildPagination } = require("../../src/utils/queryBuilder");

describe("buildListQuery", () => {
  it("builds a $or free-text filter across searchFields", () => {
    const filter = buildListQuery({ q: "bella" }, { searchFields: ["name", "breed"] });
    expect(filter.$or).toEqual([
      { name: { $regex: "bella", $options: "i" } },
      { breed: { $regex: "bella", $options: "i" } },
    ]);
  });

  it("applies exact-match filters for whitelisted fields", () => {
    const filter = buildListQuery({ status: "Available" }, { filterFields: ["status"] });
    expect(filter.status).toBe("Available");
  });

  it('treats the literal "All" as no filter', () => {
    const filter = buildListQuery({ status: "All" }, { filterFields: ["status"] });
    expect(filter.status).toBeUndefined();
  });

  it("applies a createdAt date range from from/to", () => {
    const filter = buildListQuery({ from: "2026-01-01", to: "2026-02-01" }, {});
    expect(filter.createdAt.$gte).toEqual(new Date("2026-01-01"));
    expect(filter.createdAt.$lte).toEqual(new Date("2026-02-01"));
  });

  it("excludes soft-deleted records unless includeDeleted=true is allowed and set", () => {
    const filterDefault = buildListQuery({}, {});
    expect(filterDefault.isDeleted).toEqual({ $ne: true });

    const filterBlocked = buildListQuery({ includeDeleted: "true" }, { allowIncludeDeleted: false });
    expect(filterBlocked.isDeleted).toEqual({ $ne: true });

    const filterAllowed = buildListQuery({ includeDeleted: "true" }, { allowIncludeDeleted: true });
    expect(filterAllowed.isDeleted).toBeUndefined();
  });
});

describe("buildSort", () => {
  it("defaults to -createdAt (newest first)", () => {
    expect(buildSort({})).toEqual({ createdAt: -1 });
  });

  it("respects sortBy/sortOrder", () => {
    expect(buildSort({ sortBy: "name", sortOrder: "asc" })).toEqual({ name: 1 });
  });
});

describe("buildPagination", () => {
  it("computes pages with a floor of 1 for empty result sets", () => {
    const pagination = buildPagination(0, 1, 20);
    expect(pagination.pages).toBe(1);
    expect(pagination.total).toBe(0);
  });

  it("clamps page and limit to sane minimums", () => {
    const pagination = buildPagination(50, 0, 0);
    expect(pagination.page).toBe(1);
    expect(pagination.limit).toBe(1);
  });

  it("caps limit at 100 to prevent a client requesting the full collection", () => {
    const pagination = buildPagination(1000, 1, 999999);
    expect(pagination.limit).toBe(100);
  });

  it("computes pages as ceil(total/limit)", () => {
    const pagination = buildPagination(45, 1, 20);
    expect(pagination.pages).toBe(3);
    expect(pagination.skip).toBe(0);
  });
});
