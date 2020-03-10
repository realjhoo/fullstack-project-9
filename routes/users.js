"use strict";
const express = require("express");
const auth = require("basic-auth");
const bcryptjs = require("bcryptjs");
const router = express.Router();
const { check, validationResult } = require("express-validator");
// TESTING
const { User } = require("../models").models;
const Sequelize = require("sequelize");

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
const authenticateUser = async (req, res, next) => {
  let message = null;

  // get the db user info
  const users = await User.findAll();
  // Parse the user's credentials from the Authorization header.
  const credentials = auth(req);

  // If the user's credentials are available...
  if (credentials) {
    // Attempt to retrieve the user from the data store
    const user = users.find(user => user.emailAddress === credentials.name);

    // If a user was successfully retrieved from the data store...
    if (user) {
      // Use bcryptjs to compare the user's password to the hashed password in db
      const authenticated = bcryptjs.compareSync(
        credentials.pass,
        user.password
      );

      // If the passwords match...
      if (authenticated) {
        console.log(`Authentication successful for ${user.emailAddress}`);

        // Store retrieved user object on the request object
        // so middleware will have access to user's information.
        req.currentUser = user;
      } else {
        // Set an error message is something went wrong
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
    // Return 401 Unauthorized
    res.status(401).json({ message: "Access Denied" });
  } else {
    // Or if user authentication succeeded...
    next();
  }
};

// ======== USER ROUTES ===================================
// GET USER Route * * WORKING * *
router.get(
  "/users",
  authenticateUser,
  asyncHandler(async (req, res) => {
    const user = req.currentUser;
    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      emailAddress: user.emailAddress
    });
  })
);
// [
//   check("firstName")
//     .exists({ checkNull: true, checkFalse: true })
//     .withMessage("Please provide a FIRST-NAME value."),
//   check("lastName")
//     .exists({ checkNull: true, checkFalse: true })
//     .withMessage("Please provide a LAST-NAME value."),
//   check("emailAddress")
//     .exists({ checkNull: true, checkFalse: true })
//     .withMessage("Please provide an EMAIL value."),
//   check("password")
//     .exists({ checkNull: true, checkFalse: true })
//     .withMessage("Please provide a PASSWORD value.")
// ],

// NEW USER Route * * WORKING * *
router.post(
  "/users",
  asyncHandler(async (req, res) => {
    console.log("In the /user root route");

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);

      // return res.status(400).json({ errors: errorMessages });
      res.status(400).json({ errors: errorMessages });
    } else {
      // get the user from the request body
      const user = req.body;

      user.password = bcryptjs.hashSync(user.password);

      // create user in database
      await User.create(user);

      // set status to 201, send to root and end
      res
        .status(201)
        .location("/")
        .end();
    }
  })
);

// EXPORTS
module.exports = router;
