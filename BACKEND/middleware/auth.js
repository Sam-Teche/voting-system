const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

// JWT Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).send({ message: "Unauthorized" });

  // Handle both "Bearer token" and "token" formats
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("JWT verification error:", err.message);
      return res.status(401).send({ message: "Invalid token" });
    }

    // Set req.user object with id property to match your routes
    req.user = { id: decoded.id };
    req.userId = decoded.id; // Keep this for backward compatibility
    next();
  });
};




module.exports = { verifyToken };
