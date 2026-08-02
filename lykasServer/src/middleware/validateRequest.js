/**
 * Wraps a zod schema as Express middleware. Validation failures return a
 * consistent 400 shape both frontends can map straight onto form fields
 * (§11.1). Schemas should use .strict() to reject unknown fields rather
 * than silently ignoring them.
 */
function validateRequest(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || source,
        message: issue.message,
      }));
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validateRequest;
