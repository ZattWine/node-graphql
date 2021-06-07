const bcrypt = require("bcrypt");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Post = require("../models/post");
const { clearImage } = require("../util/file");

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
      error.code = 422;
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
    const hashedPass = await bcrypt.hash(
      userInput.password.toString().trim(),
      saltRound
    );
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
      error.code = 401;
      throw error;
    }

    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error("Password does not match.");
      error.code = 401;
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

  createPost: async function ({ postInput }, req) {
    // check auth
    if (!req.isAuth) {
      const error = new Error("Not authenticated.");
      error.code = 401;
      throw error;
    }

    const errors = [];
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      errors.push({ message: "Title is invalid." });
    }
    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: "Title is invalid." });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid input.");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Invalid user.");
      error.code = 401;
      throw error;
    }

    const post = Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user,
    });
    const createdPost = await post.save();
    user.posts.push(createdPost);
    await user.save();

    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },

  posts: async ({ page }, req) => {
    // check auth
    if (!req.isAuth) {
      const error = new Error("Not authenticated.");
      error.code = 401;
      throw error;
    }

    if (!page) {
      page = 1;
    }
    const perPage = 2;
    const totalPosts = await Post.find().countDocuments();
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate("creator");

    return {
      posts: posts.map((p) => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts: totalPosts,
    };
  },

  post: async ({ id }, req) => {
    // check auth
    if (!req.isAuth) {
      const error = new Error("Not authenticated.");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id).populate("creator");
    if (!post) {
      const error = new Error("No post found.");
      error.code = 404;
      throw error;
    }

    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },

  updatePost: async ({ id, postInput }, req) => {
    // check auth
    if (!req.isAuth) {
      const error = new Error("Not authenticated.");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id).populate("creator");

    // check post exists.
    if (!post) {
      const error = new Error("No post found.");
      error.code = 404;
      throw error;
    }

    // check authorization
    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error("Not authorized.");
      error.code = 403;
      throw error;
    }

    // validation
    const errors = [];
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      errors.push({ message: "Title is invalid." });
    }
    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: "Title is invalid." });
    }
    if (errors.length > 0) {
      const error = new Error("Invalid input.");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    post.title = postInput.title;
    post.content = postInput.content;

    if (postInput.imageUrl !== "undefined") {
      post.imageUrl = postInput.imageUrl;
    }

    const updatePost = await post.save();
    return {
      ...updatePost._doc,
      _id: updatePost._id.toString(),
      createdAt: updatePost.createdAt.toISOString(),
      updatedAt: updatePost.updatedAt.toISOString(),
    };
  },

  deletePost: async ({ id }, req) => {
    // check auth
    if (!req.isAuth) {
      const error = new Error("Not authenticated.");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id);
    // check post exists.
    if (!post) {
      const error = new Error("No post found.");
      error.code = 404;
      throw error;
    }

    // check authorization
    if (post.creator.toString() !== req.userId.toString()) {
      const error = new Error("Not authorized.");
      error.code = 403;
      throw error;
    }

    clearImage(post.imageUrl);
    await Post.findByIdAndDelete(id);
    const user = await User.findById(req.userId);
    user.posts.pull(id);
    await user.save();

    return true;
  },

  user: async (args, req) => {
    // check auth
    if (!req.isAuth) {
      const error = new Error("Not authenticated.");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("No user found.");
      error.code = 404;
      throw error;
    }

    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },

  updateStatus: async ({ status }, req) => {
    // check auth
    if (!req.isAuth) {
      const error = new Error("Not authenticated.");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("No user found.");
      error.code = 404;
      throw error;
    }

    user.status = status;
    await user.save();

    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },
};
