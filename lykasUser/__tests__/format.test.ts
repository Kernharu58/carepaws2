import { formatDate } from "../utils/format";

describe("formatDate", () => {
  it("formats a valid date string", () => {
    expect(formatDate("2026-03-15T00:00:00.000Z")).toBe("Mar 15, 2026");
  });

  it("formats a valid Date object", () => {
    expect(formatDate(new Date("2026-03-15T00:00:00.000Z"))).toBe("Mar 15, 2026");
  });

  it("returns a placeholder for null instead of throwing", () => {
    expect(formatDate(null)).toBe("Not set");
  });

  it("returns a placeholder for undefined instead of throwing", () => {
    expect(formatDate(undefined)).toBe("Not set");
  });

  it("returns a placeholder for an unparseable date string instead of returning 'Invalid Date'", () => {
    expect(formatDate("not-a-real-date")).toBe("Not set");
  });
});
