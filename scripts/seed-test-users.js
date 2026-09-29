/* eslint-disable no-console */
const connectDB = require("../src/config/db");
const { getDB } = require("../src/config/db");
const User = require("../src/models/User");
const Company = require("../src/models/Company");

const TEST_USERS = [
  { name: "Mahima Seldiya 1", email: "mahimaseldiya1@gmail.com" },
  { name: "Mahima Seldiya 3", email: "mahimaseldiya3@gmail.com" },
  { name: "Mahima Seldiya 7", email: "mahimaseldiya7@gmail.com" },
  { name: "Mahima Seldiya 365", email: "mahimaseldiya365@gmail.com" },
];

const run = async () => {
  await connectDB();
  try {
  const company = await Company.findOne({ status: "active" }).sort({
    createdAt: 1,
  });

  for (const u of TEST_USERS) {
    let user = await User.findOne({ email: u.email });
    if (user) {
      user.name = u.name;
      user.isRegistered = true;
      user.emailConfirmed = true;
      user.status = "active";
      user.company = company ? company._id : null;
      user.password = "Customer@123";
      await user.save();
    } else {
      user = await User.create({
        name: u.name,
        email: u.email,
        password: "Customer@123",
        isRegistered: true,
        emailConfirmed: true,
        status: "active",
        company: company ? company._id : null,
      });
    }
    console.log(
      `Test user ready: ${user.email} / Customer@123 (company: ${company ? company.name : "none"})`,
    );
  }

  } finally {
    await getDB().destroy();
  }
};

run().catch((err) => {
  console.error("Seed test users failed:", err.message);
  process.exit(1);
});
