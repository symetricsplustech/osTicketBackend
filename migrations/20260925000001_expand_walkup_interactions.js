exports.up = async function up(knex) {
  await knex.schema.alterTable("walkup_interactions", (table) => {
    table.string("number");
    table.string("channel").defaultTo("walk_in");
    table.string("requester_name").defaultTo("");
    table.string("requester_email").defaultTo("");
    table.string("summary").defaultTo("");
    table.text("description").defaultTo("");
    table.string("status").defaultTo("new");
    table.string("priority").defaultTo("P3");
    table.timestamp("started_at");
    table.timestamp("ended_at");
    table.integer("duration_minutes");
    table.string("outcome").defaultTo("");
    table.uuid("incident_id");
    table.uuid("request_id");
    table.jsonb("metadata").defaultTo("{}");
    table.uuid("created_by");
    table.index(["tenant_id", "status"]);
    table.index(["tenant_id", "channel"]);
    table.unique(["tenant_id", "number"]);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("walkup_interactions", (table) => {
    table.dropUnique(["tenant_id", "number"]);
    table.dropIndex(["tenant_id", "channel"]);
    table.dropIndex(["tenant_id", "status"]);
    table.dropColumns("number", "channel", "requester_name", "requester_email", "summary", "description", "status", "priority", "started_at", "ended_at", "duration_minutes", "outcome", "incident_id", "request_id", "metadata", "created_by");
  });
};
