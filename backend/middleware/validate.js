const { validationResult } = require('express-validator');

/** Check express-validator results. Returns 400 with errors if validation fails. */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
};

module.exports = { validate };
