const path = require("path");
const fs = require("fs");

/**
 * Helper function for clearing image.
 */
const clearImage = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => {
    console.log(err);
  });
};

exports.clearImage = clearImage;
