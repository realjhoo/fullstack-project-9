const express = require("express");
const auth = require("basic-auth");
const bcryptjs = require("bcryptjs");
const router = express.Router();
const { check, validationResult } = require("express-validator");

// ========================================================
// error wrapper function
function asyncHandler(cb) {
  return async (req, res, next) => {
    try {
      await cb(req, res, next);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
}

// ========================================================
// Authentication from earlier lesson
const authenticateUser = (req, res, next) => {
  let message = null;
  // Parse the user's credentials from the Authorization header.
  const credentials = auth(req);

  // If the user's credentials are available...
  if (credentials) {
    // Attempt to retrieve the user from the data store
    // by their username (i.e. the user's "key"
    // from the Authorization header).
    const user = users.find(u => u.username === credentials.name);

    // If a user was successfully retrieved from the data store...
    if (user) {
      // Use the bcryptjs npm package to compare the user's password
      // (from the Authorization header) to the user's password
      // that was retrieved from the data store.
      const authenticated = bcryptjs.compareSync(
        credentials.pass,
        user.password
      );

      // If the passwords match...
      if (authenticated) {
        console.log(`Authentication successful for ${user.username}`);

        // Then store the retrieved user object on the request object
        // so any middleware functions that follow this middleware function
        // will have access to the user's information.
        req.currentUser = user;
      } else {
        message = `Authentication failure for ${user.username}`;
      }
    } else {
      message = `User not found: ${credentials.name}`;
    }
  } else {
    message = "Auth header not found";
  }

  // If user authentication failed...
  if (message) {
    console.warn(message);
    // Return a response with a 401 Unauthorized HTTP status code.
    res.status(401).json({ message: "Access Denied" });
  } else {
    // Or if user authentication succeeded...
    // Call the next() method.
    next();
  }
};

// ======== USER ROUTES ===================================
router.post(
  "/users",
  [
    check("name")
      .exists({ checkNull: true, checkFalst: true })
      .withMessage("Please provide a NAME value."),
    check("username")
      .exists({ checkNull: true, checkFalst: true })
      .withMessage("Please provide a USERNAME value."),
    check("password")
      .exists({ checkNull: true, checkFalst: true })
      .withMessage("Please provide a PASSWORD value.")
  ],
  (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.status(400).json({ errors: errorMessages });
    }
    // get the user from the request body
    const user = req.body;

    user.password = bcryptjs.hashSync(user.password);

    // add user to users array
    users.push(user);

    // set status to 201 and end
    return res.status(201).end();
  }
);

// EXPORTS
module.exports = router;
