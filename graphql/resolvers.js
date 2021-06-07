const User = require("../models/user");
const bcrypt = require("bcrypt");
const validator = require("validator");
const jwt = require("jsonwebtoken");

module.exports = {
  createUser: async function ({ userInput }, req) {
    // const email = args.userInput.email;

    const errors = [];
    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: "E-Mail is invalid." });
    }
    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      errors.push({ message: "Password is too short." });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input.");
      error.data = errors;
      error.statusCode = 422;
      throw error;
    }

    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error("User exists already.");
      throw error;
    }

    // rounds=8 : ~40 hashes/sec
    // rounds=9 : ~20 hashes/sec
    // rounds=10: ~10 hashes/sec
    // rounds=11: ~5  hashes/sec
    // rounds=12: 2-3 hashes/sec
    // rounds=13: ~1 sec/hash
    // rounds=14: ~1.5 sec/hash
    // rounds=15: ~3 sec/hash
    // rounds=25: ~1 hour/hash
    // rounds=31: 2-3 days/hash
    const saltRound = 12; // recommand
    const hashedPass = await bcrypt.hash(userInput.password, saltRound);
    const user = new User({
      email: userInput.email,
      password: hashedPass,
      name: userInput.name,
    });
    const createdUser = await user.save();

    return {
      ...createdUser._doc,
      _id: createdUser._id.toString(),
    };
  },
  login: async function ({ email, password }) {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = Error("User not found.");
      error.statusCode = 401;
      throw error;
    }

    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = (new Error(
        "Password does not match."
      ).error.statusCode = 401);
      throw error;
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      "somesuperscrectscrect",
      { expiresIn: "1h" }
    );

    return {
      token: token,
      userId: user._id.toString(),
    };
  },
};
