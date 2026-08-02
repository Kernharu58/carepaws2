/**
 * Shared list-query contract (§8.2). Every list-style controller should
 * build its Mongo filter/sort/pagination through this, rather than
 * inventing per-resource query handling.
 *
 * @param {import('express').Request['query']} query
 * @param {object} options
 * @param {string[]} options.searchFields - fields eligible for the free-text `q` param
 * @param {string[]} options.filterFields - fields eligible for exact-match filtering
 * @param {boolean} options.allowIncludeDeleted - whether `includeDeleted=true` is honored
 *   (should be false for public/self-service routes regardless of the query param)
 */
function buildListQuery(query, { searchFields = [], filterFields = [], allowIncludeDeleted = false } = {}) {
  const filter = {};

  if (query.q && searchFields.length > 0) {
    filter.$or = searchFields.map((field) => ({
      [field]: { $regex: String(query.q), $options: "i" },
    }));
  }

  for (const field of filterFields) {
    const value = query[field];
    if (value !== undefined && value !== "" && value !== "All") {
      filter[field] = value;
    }
  }

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(String(query.from));
    if (query.to) filter.createdAt.$lte = new Date(String(query.to));
  }

  if (!allowIncludeDeleted || query.includeDeleted !== "true") {
    filter.isDeleted = { $ne: true };
  }

  return filter;
}

function buildSort(query) {
  const sortBy = typeof query.sortBy === "string" && query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder === "asc" ? 1 : -1;
  return { [sortBy]: sortOrder };
}

function buildPagination(total, page, limit) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const pages = Math.max(1, Math.ceil(total / safeLimit));
  return {
    total,
    page: safePage,
    limit: safeLimit,
    pages,
    skip: (safePage - 1) * safeLimit,
  };
}

module.exports = { buildListQuery, buildSort, buildPagination };
