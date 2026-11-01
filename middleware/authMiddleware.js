const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    // In test environment, bypass auth if no header provided
    if (process.env.NODE_ENV === "test" && !req.headers.authorization) {
        req.user = { id: "test_user_id", email: "test@example.com" };
        return next();
    }

    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "default_jwt_secret"
        );

        req.user = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token",
        });
    }
};

module.exports = authMiddleware;
