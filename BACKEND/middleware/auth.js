const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

// JWT Middleware
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).send({ message: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: "Invalid token" });
    req.userId = decoded.id;
    next();
  });
};

module.exports = { verifyToken };
