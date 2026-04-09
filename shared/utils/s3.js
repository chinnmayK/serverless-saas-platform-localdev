const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  region: process.env.S3_REGION || process.env.AWS_REGION || "ap-south-1",
});

module.exports = s3;
