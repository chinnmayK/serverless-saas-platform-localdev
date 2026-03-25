const jwt = require("jsonwebtoken");
const response = require("../utils/response");

const JWT_SECRET = process.env.JWT_SECRET || "local_dev_jwt_secret_change_in_prod";

module.exports = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return response.unauthorized(res, "Missing or invalid Authorization header");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return response.unauthorized(res, "Invalid or expired token");
  }
};
