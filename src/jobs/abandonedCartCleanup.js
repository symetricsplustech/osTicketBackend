/**
 * Abandoned Cart Cleanup — archives carts inactive for >7 days.
 */
const cron = require("node-cron");
const mongoose = require("mongoose");

const CART_ARCHIVE_DAYS = parseInt(process.env.CART_ARCHIVE_DAYS || "7", 10);

async function cleanupAbandonedCarts() {
  const Cart = mongoose.model("Cart");
  const cutoff = new Date(Date.now() - CART_ARCHIVE_DAYS * 24 * 60 * 60 * 1000);
  const result = await Cart.updateMany(
    { status: "active", updatedAt: { $lt: cutoff }, isDeleted: false },
    {
      $set: {
        status: "abandoned",
        abandonedAt: new Date(),
        abandonedReason: "auto_cleanup",
      },
    },
  );
  if (result.modifiedCount > 0) {
    console.log(
      `[abandonedCartCleanup] archived ${result.modifiedCount} inactive carts`,
    );
  }
  return result;
}

function start() {
  // Run daily at 03:00
  cron.schedule("0 3 * * *", async () => {
    try {
      await cleanupAbandonedCarts();
    } catch (e) {
      console.error("[abandonedCartCleanup]", e.message);
    }
  });
  console.log("[job] abandonedCartCleanup scheduled (daily 03:00)");
}

module.exports = { start, cleanupAbandonedCarts };
