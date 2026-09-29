const knex = require("knex");
const config = require("./config");
const logger = require("../utils/logger");

let db;

const connectDB = async () => {
  if (db) return db;
  try {
    const pgConfig = config.postgres;
    const sslConfig = pgConfig.ssl
      ? { rejectUnauthorized: false, ca: pgConfig.sslCA ? require("fs").readFileSync(require("path").join(__dirname, "../../", pgConfig.sslCA)) : undefined }
      : false;
    const connectionConfig = pgConfig.connectionString
      ? { connectionString: pgConfig.connectionString, ssl: sslConfig }
      : {
          host: pgConfig.host,
          port: pgConfig.port,
          user: pgConfig.user,
          password: pgConfig.password,
          database: pgConfig.database,
          ssl: sslConfig,
        };

    db = knex({
      client: "pg",
      connection: connectionConfig,
      pool: {
        // The managed instance allows 20 connections in total and several
        // services share it. A 20-connection default let this one process take
        // every slot and starve everything else, so the default stays well
        // below the ceiling; raise it with DB_MAX_POOL when the instance is
        // dedicated.
        min: parseInt(process.env.DB_MIN_POOL || "2", 10),
        max: parseInt(process.env.DB_MAX_POOL || "5", 10),
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
      },
    });

    // Verify connection
    await db.raw("SELECT 1");
    logger.info(`PostgreSQL connected: ${pgConfig.host || "via connection string"}:${pgConfig.port || 5432}/${pgConfig.database}`);

    // Run migrations
    const [batchNo, log] = await db.migrate.latest({
      directory: require("path").join(__dirname, "../../migrations"),
    });
    if (log.length === 0) {
      logger.info("PostgreSQL schema up to date");
    } else {
      logger.info(`PostgreSQL migrated: batch ${batchNo}, ${log.length} migration(s) applied`);
    }

    return db;
  } catch (err) {
    logger.error(`PostgreSQL connection error: ${err.message}`);
    if (db) {
      await db.destroy();
      db = undefined;
    }
    throw err;
  }
};

const getDB = () => {
  if (!db) throw new Error("Database not initialized. Call connectDB() first.");
  return db;
};

module.exports = connectDB;
module.exports.getDB = getDB;
