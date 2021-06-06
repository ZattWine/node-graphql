const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const multer = require("multer");

const app = express();

/**
 * Filestorage.
 */
const fileStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, "images");
  },
  filename: (req, file, callback) => {
    callback(null, new Date().toISOString() + "-" + file.originalname);
  },
});

/**
 * File filter.
 */
const fileFilter = (req, file, callback) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    callback(null, true);
  } else {
    callback(null, false);
  }
};

/**
 * Middleware for body parsing type json.
 * application/json
 */
app.use(bodyParser.json());

/**
 * Middleware for file storage.
 */
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);
app.use("/images", express.static(path.join(__dirname, "images")));

// Errors handling
app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

mongoose
  .connect(
    "mongodb+srv://zattwine:q1lm5aP1EQbh1GpV@cluster0.c5muj.mongodb.net/messages-graphql?authSource=admin&replicaSet=atlas-uueejk-shard-0&readPreference=primary&appname=MongoDB%20Compass&ssl=true",
    { useUnifiedTopology: true, useNewUrlParser: true }
  )
  .then((result) => {
    console.log("CONNECTED TO DATABASE!");
  })
  .catch((err) => console.log(err));
