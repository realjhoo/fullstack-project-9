"use strict";
// requires
const express = require("express");
const auth = require("basic-auth");
const bcryptjs = require("bcryptjs");
const { check, validationResult } = require("express-validator");

// Const vars
const router = express.Router();

// TESTING
const { User, Course } = require("../models").models;
const Sequelize = require("sequelize");

// I'd like to seperate asyncHandler and authenticateUser
// into a seperate module, and have a users route module
//  and a courses route module... but I dont know how
// so I'll just put everything here to be DRY
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
    res.status(401).json({ message: "Access Denied * = *" });
  } else {
    // Or if user authentication succeeded...
    next();
  }
};

// ======== USERS ROUTES ===================================
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

// might need this for validation checking... leave here for now
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

// ======== COURSES ROUTES ===================================
// get courses route * * * IN PROGRESS * * *
router.get(
  "/courses",
  asyncHandler(async (req, res) => {
    const courses = await Course.findAll({
      attributes: {
        exclude: ["createdAt", "updatedAt"]
      },
      include: [
        {
          model: User,
          attributes: {
            exclude: ["password", "createdAt", "updatedAt"]
          }
        }
      ]
    });
    res.json(courses);
  })
);

// get Course
router.get(
  "/courses/:id",
  asyncHandler(async (req, res) => {
    const course = await Course.findByPk(req.params.id, {
      attributes: {
        exclude: ["createdAt", "updatedAt"]
      },
      include: [
        {
          model: User,
          attributes: {
            exclude: ["password", "createdAt", "updatedAt"]
          }
        }
      ]
    });
    res.status(200).json(course);
  })
);

// Create Course
router.post(
  "/courses",
  authenticateUser,
  asyncHandler(async (req, res) => {
    try {
      const course = await Course.create(req.body);
      res
        .status(201)
        .location("/courses/" + course.id)
        .end();
    } catch (error) {
      if (error.name === "SequelizeValidationError") {
        const svError = error.errors.map(err => err.message);
        res.status(400).json({ svError });
        console.error("Sequelize Validation Error creating course: ", svError);
      } else {
        console.log(
          "Something has gone terribly wrong! Sorry... that's all I know."
        );
        throw error;
      }
    }
  })
);

// Update Course
router.put(
  "/courses/:id",
  authenticateUser,
  [
    check("title")
      .exists()
      .withMessage("Please provide a course title."),
    check("description")
      .exists()
      .withMessage("Please provide a course description"),
    check("userId")
      .exists()
      .withMessage("Please provide a User ID")
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      res.status(400).json({ errors: errorMessages });
    } else {
      const user = req.currentUser;
      const course = await Course.findByPk(req.params.id);
      if (user.id === course.userId) {
        await course.update(req.body);
        res.status(200).end();
      } else {
        res
          .status(403)
          .json({ message: "User not authorized to make changes." });
      }
    }
  })
);

// **************************************************************************************************************************************************************************************************************************
// error should be caufghght here with a 403, but is being caught
// on line 76 with a 401

// Delete Course
router.delete(
  "/courses/:id",
  authenticateUser,
  asyncHandler(async (req, res, next) => {
    const user = req.currentUser;
    const course = await Course.findByPk(req.params.id);
    if (course) {
      if (user.id === course.userId) {
        await course.destroy();
        res.status(200).end();
      } else {
        res
          .status(403)
          .json({ message: "User unauthorized to delete this course." });
      }
    }
  })
);

// EXPORTS
module.exports = router;
