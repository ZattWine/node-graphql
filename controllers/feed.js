const fs = require("fs");
const path = require("path");

const { validationResult } = require("express-validator");

const io = require("../socket");
const Post = require("../models/post");
const User = require("../models/user");

/**
 * Fetch posts.
 */
exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;

  try {
    const totalItems = await Post.find().countDocuments();
    const posts = await Post.find()
      .populate("creator")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: "Fetched posts successfully.",
      posts: posts,
      totalItems: totalItems,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }

    next(err);
  }
};

/**
 * Create a post.
 */
exports.createPost = async (req, res, next) => {
  // req validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed, entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  if (!req.file) {
    const error = new Error("No image provided.");
    error.statusCode = 422;
    throw error;
  }

  const imageUrl = req.file.path;
  const title = req.body.title;
  const content = req.body.content;
  let creator;
  const post = new Post({
    title: title,
    content: content,
    imageUrl: imageUrl,
    creator: req.userId,
  });

  try {
    await post.save();
    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("No user found.");
      error.statusCode = 404;
      throw error;
    }

    creator = user;
    user.posts.push(post);
    await user.save();

    // socket.io
    io.getIO().emit("posts", {
      action: "create",
      post: { ...post._doc, creator: { _id: req.userId, name: user.name } },
    });

    res.status(201).json({
      message: "Post created successfully.",
      post: post,
      creator: { _id: creator._id, name: creator.name },
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }

    next(err);
  }
};

/**
 * Get a single post.
 */
exports.getPost = async (req, res, next) => {
  const postId = req.params.postId;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error("Could not find a post.");
      error.statusCode = 404;
      throw err;
    }

    res.status(200).json({ message: "Post fetch.", post: post });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }

    next(err);
  }
};

/**
 * Update the post.
 */
exports.updatePost = async (req, res, next) => {
  // req validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed, entered data is incorrect.");
    error.statusCode = 422;
    throw error;
  }

  const postId = req.params.postId;
  const title = req.body.title;
  const content = req.body.content;
  let imageUrl = req.body.image;
  if (req.file) {
    imageUrl = req.file.path;
  }

  if (!imageUrl) {
    const error = new Error("No file picked.");
    error.statusCode = 422;
    throw error;
  }

  try {
    const post = await Post.findById(postId).populate("creator");
    if (!post) {
      const error = new Error("Could not find a post.");
      error.statusCode = 404;
      throw err;
    }

    // check post is created by current user?
    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("Not authorized.");
      error.statusCode = 403;
      throw error;
    }

    if (imageUrl !== post.imageUrl) {
      clearImage(post.imageUrl);
    }

    post.title = title;
    post.content = content;
    post.imageUrl = imageUrl;
    const result = await post.save();

    // socket
    io.getIO().emit("posts", { action: "update", post: result });

    res.status(200).json({
      message: "Post updated.",
      post: result,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }

    next(err);
  }
};

/**
 * Delete the post.
 */
exports.deletePost = async (req, res, next) => {
  const postId = req.params.postId;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      const error = new Error("Could not find a post.");
      error.statusCode = 404;
      throw err;
    }

    // check post is created by current user?
    if (post.creator.toString() !== req.userId) {
      const error = new Error("Not authorized.");
      error.statusCode = 403;
      throw error;
    }

    clearImage(post.imageUrl);

    await Post.findByIdAndRemove(postId);

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("No user found.");
      error.statusCode = 404;
      throw error;
    }

    user.posts.pull(postId);
    await user.save();

    // io
    io.getIO().emit("posts", { action: "delete", postId: postId });

    res.status(200).json({ message: "Deleted post." });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }

    next(err);
  }
};

/**
 * Helper function for clearing image.
 */
const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => {
    console.log(err);
  });
};
