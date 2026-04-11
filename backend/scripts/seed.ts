/**
 * Idempotent demo data seeder.
 * Re-run safely: skips when the demo user already has plants.
 *
 * Usage: npm run seed
 * Requires MONGODB_URI (and JWT secrets are not needed for seeding).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/db";
import {
  computeInitialNextDueAt,
  ensurePendingTask,
  isDueOnOrBeforeEndOfUserDay,
} from "../src/lib/care-utils";
import ActivityLog from "../src/models/ActivityLog";
import CarePlan from "../src/models/CarePlan";
import Plant from "../src/models/Plant";
import Task from "../src/models/Task";
import User from "../src/models/User";

const DEMO_EMAIL = "demo@bloomiq.app";
const DEMO_PASSWORD = "password123";
const DEMO_NAME = "Demo Gardener";

/** Align hasEmbeddedImage with stored image bytes (fixes list URLs after schema changes). */
async function syncEmbeddedImageFlags() {
  let fixed = 0;
  const cursor = Plant.find({}).select("+imageData").cursor();
  for await (const p of cursor) {
    const buf = p.imageData as Buffer | undefined;
    const has = Boolean(buf && Buffer.isBuffer(buf) && buf.length > 0);
    if (Boolean(p.hasEmbeddedImage) !== has) {
      await Plant.collection.updateOne(
        { _id: p._id },
        { $set: { hasEmbeddedImage: has } }
      );
      fixed += 1;
    }
  }
  if (fixed > 0) {
    console.log(`Synced hasEmbeddedImage for ${fixed} plant document(s).`);
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI. Copy .env.example to .env and fill values.");
    process.exit(1);
  }

  await connectToDatabase();
  await syncEmbeddedImageFlags();

  let user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    user = await User.create({
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      passwordHash,
      timezone: "Asia/Kolkata",
      notificationEnabled: true,
    });
    console.log("Created demo user:", DEMO_EMAIL);
  } else {
    console.log("Demo user exists:", DEMO_EMAIL);
  }

  const existingPlantCount = await Plant.countDocuments({ userId: user._id });
  if (existingPlantCount >= 3) {
    console.log(
      "Seed skipped: demo user already has plants (idempotent).",
      `count=${existingPlantCount}`
    );
    await mongoose.disconnect();
    return;
  }

  const tz = user.timezone ?? "Asia/Kolkata";

  const plantSpecs = [
    {
      name: "Monstera Deliciosa",
      species: "Monstera deliciosa",
      location: "Living room",
      status: "healthy" as const,
    },
    {
      name: "Snake Plant",
      species: "Dracaena trifasciata",
      location: "Bedroom",
      status: "healthy" as const,
    },
    {
      name: "Fiddle Leaf Fig",
      species: "Ficus lyrata",
      location: "Office",
      status: "needs_attention" as const,
    },
  ];

  const plants = [];
  for (const spec of plantSpecs) {
    let p = await Plant.findOne({ userId: user._id, name: spec.name });
    if (!p) {
      p = await Plant.create({
        userId: user._id,
        ...spec,
        notes: "Seeded plant for BloomIQ development.",
      });
      console.log("Created plant:", spec.name);
    } else {
      console.log("Plant already exists:", spec.name);
    }
    plants.push(p);
  }

  const start = new Date();
  start.setDate(start.getDate() - 2);

  for (let i = 0; i < plants.length; i++) {
    const plant = plants[i];
    const types = ["watering", "fertilizing", "pruning"] as const;
    const type = types[i % types.length];
    const frequencyDays = 7 + (i % 3);

    let plan = await CarePlan.findOne({
      userId: user._id,
      plantId: plant._id,
      type,
      isActive: true,
    });

    if (!plan) {
      const nextDueAt = computeInitialNextDueAt(start, tz);
      plan = await CarePlan.create({
        userId: user._id,
        plantId: plant._id,
        type,
        frequencyDays,
        startDate: start,
        lastCompletedAt: null,
        nextDueAt,
        isActive: true,
      });
      console.log("Created care plan:", type, "for", plant.name);

      if (isDueOnOrBeforeEndOfUserDay(nextDueAt, tz)) {
        await ensurePendingTask({
          userId: user._id,
          plantId: plant._id,
          carePlanId: plan._id,
          type,
          dueAt: nextDueAt,
        });
      }
    }
  }

  const firstPlant = plants[0];
  const pendingTask = await Task.findOne({
    userId: user._id,
    plantId: firstPlant._id,
    status: "pending",
  });

  if (pendingTask) {
    const exists = await ActivityLog.findOne({
      userId: user._id,
      plantId: firstPlant._id,
      action: "note_added",
    });
    if (!exists) {
      await ActivityLog.create({
        userId: user._id,
        plantId: firstPlant._id,
        taskId: pendingTask._id,
        action: "note_added",
        date: new Date(),
        notes: "Checked leaves — no pests spotted.",
      });
      console.log("Created sample activity log.");
    }
  }

  console.log("Seed complete.");
  console.log("Login:", DEMO_EMAIL, "/", DEMO_PASSWORD);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
