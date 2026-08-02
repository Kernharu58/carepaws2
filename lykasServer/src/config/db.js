const dns = require("dns");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

// Avoid flaky local DNS resolution of the mongodb+srv:// record by pinning
// public resolvers before Mongoose attempts the SRV lookup.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set");
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri);

  logger.info({ host: mongoose.connection.host }, "MongoDB connected");

  mongoose.connection.on("error", (err) => {
    logger.error({ err }, "MongoDB connection error");
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });

  return mongoose.connection;
}

module.exports = connectDB;
