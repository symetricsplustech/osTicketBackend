require("dotenv").config({ path: require("path").join(__dirname, ".env") });
require("dotenv").config({ path: require("path").join(__dirname, ".env.local"), override: true });
const fs = require("fs");

const baseConfig = {
  client: "pg",
  pool: {
    min: parseInt(process.env.DB_MIN_POOL || "2", 10),
    max: parseInt(process.env.DB_MAX_POOL || "20", 10),
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },
  migrations: {
    directory: "./migrations",
    tableName: "knex_migrations",
  },
  seeds: {
    directory: "./seeds",
  },
};

module.exports = {
  development: {
    ...baseConfig,
    connection: {
      host: process.env.PG_HOST || "127.0.0.1",
      port: parseInt(process.env.PG_PORT || "5432", 10),
      user: process.env.PG_USER || "postgres",
      password: process.env.PG_PASSWORD || "",
      database: process.env.PG_DATABASE || "osticket_dev",
      ssl: process.env.PG_SSL === "true"
        ? { rejectUnauthorized: false, ca: process.env.PG_CA_CERT ? fs.readFileSync(process.env.PG_CA_CERT) : undefined }
        : false,
    },
  },
  production: {
    ...baseConfig,
    connection: {
      connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING,
      ssl: process.env.PG_SSL === "true"
        ? { rejectUnauthorized: false, ca: process.env.PG_CA_CERT ? fs.readFileSync(process.env.PG_CA_CERT) : undefined }
        : false,
    },
    pool: {
      min: parseInt(process.env.DB_MIN_POOL || "5", 10),
      max: parseInt(process.env.DB_MAX_POOL || "30", 10),
    },
  },
};
