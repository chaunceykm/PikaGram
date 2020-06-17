const express = require("express");
const bcrypt = require("bcryptjs");
const { check } = require("express-validator");
const { asyncHandler, handleValidationErrors } = require("../utils");
const { getUserToken, requireAuth } = require("../auth");

const router = express.Router();
const db = require("../db/models");
const follow = require("../db/models/follow");

const { User } = db;

const validateEmailAndPassword = [
  check("email")
    .exists({ checkFalsy: true })
    .isEmail()
    .withMessage("Please provide a valid email."),
  check("password")
    .exists({ checkFalsy: true })
    .withMessage("Please provide a password."),
  handleValidationErrors,
];
//create a user
router.post(
  "/",
  check("userName")
    .exists({ checkFalsy: true })
    .withMessage("Please provide a username"),
  validateEmailAndPassword,
  asyncHandler(async (req, res) => {
    const {
      firstName,
      lastName,
      userName,
      email,
      password,
      bio,
      profilePicPath,
      age,
      gender,
    } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      firstName,
      lastName,
      userName,
      email,
      hashedPassword,
      bio,
      profilePicPath,
      age,
      gender,
    });

    const token = getUserToken(user);
    res.status(201).json({
      user: { id: user.id },
      token,
    });
  })
);
//create user token
router.post(
  "/token",
  validateEmailAndPassword,
  asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;
    const user = await User.findOne({
      where: {
        email,
      },
    });

    if (!user || !user.validatePassword(password)) {
      const err = new Error("Login failed");
      err.status = 401;
      err.title = "Login failed";
      err.errors = ["The provided credentials were invalid."];
      return next(err);
    }
    const token = getUserToken(user);
    res.json({ token, user: { id: user.id } });
  })
);

const userNotFoundError = (id) => {
  const err = Error("User not found");
  err.errors = [`User with id of ${id} could not be found.`];
  err.title = "User not found.";
  err.status = 404;
  return err;
};

//get list of all users
router.get(
  "/all",
  requireAuth,
  asyncHandler(async (req, res) => {
    const users = await User.findAll();
    res.json({ users });
  })
);

//get info for specific user
router.get(
  "/:id(\\d+)",
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const user = await User.findByPk(req.params.id);
    if (user) {
      res.json({ user });
    } else {
      next(userNotFoundError(req.params.id));
    }
  })
);

router.put(
  "/:id(\\d+)",
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const user = await User.findByPk(req.params.id);

    if (user) {
      if (req.user.id != user.id) {
        //KDEV change req.body.user to req.user
        const err = new Error("Unauthorized");
        err.status = 401;
        err.message = "You are not authorized to edit this user.";
        err.title = "Unauthorized";
        throw err;
      }
      await user.update({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        userName: req.body.userName,
        email: req.body.email,
        bio: req.body.bio,
        profilePicPath: req.body.profilePicPath,
        age: req.body.age,
        gender: req.body.gender,
      });
      res.json({ user });
    } else {
      next(userNotFoundError(req.params.id));
    }
  })
);

router.delete(
  "/:id(\\d+)",
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const user = await User.findByPk(req.params.id);

    if (user) {
      if (req.user.id != user.id) {
        //KDEV change to req.user.id
        const err = new Error("Unauthorized");
        err.status = 401;
        err.message = "You are not authorized to delete this user.";
        err.title = "Unauthorized";
        throw err;
      }
      await user.destroy();
      res.json({ message: `Deleted user with id of ${req.params.id}.` });
    } else {
      next(userNotFoundError(req.params.id));
    }
  })
);

router.get(
  "/:id(\\d+)/followers",
  asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.params.id, {
      include: {
        model: db.User,
        as: "followers",
        attributes: ["id", "userName"],
        through: {
          attributes: [],
        },
      },
    });
    res.json({ user });
  })
);

router.get(
  "/:id(\\d+)/following",
  asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.params.id, {
      include: {
        model: db.User,
        as: "following",
        attributes: ["id", "userName"],
        through: {
          attributes: [],
        },
      },
    });
    res.json({ user });
  })
);

router.post(
  "/:id(\\d+)/following/",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.id != req.params.id) { //31 = 2
      //KDEV change to req.user.id

      const err = new Error("Unauthorized");
      err.status = 401;
      err.message = "You are not authorized to follow this user.";
      err.title = "Unauthorized";
      throw err;
    }
    const follow = await db.Follow.create({
      followerId: req.body.id,
      followingId: req.user.id,
    });
    res.json({ follow });
  })
);

router.delete(
  "/:id(\\d+)/following/:followingId(\\d+)",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.id != req.params.id) {
      //KDEV change to req.user.id
      const err = new Error("Unauthorized");
      err.status = 401;
      err.message = "You are not authorized to unfollow this user.";
      err.title = "Unauthorized";
      throw err;
    }
    const follow = await db.Follow.findOne({
      where: {
        followingId: req.params.followingId,
        followerId: req.params.id,
      },
    });
    if (follow) {
      follow.destroy();
      res.json({ following: req.params.followingId });
    } else {
      res.json({ err: ["You were not following this person."] });
    }
  })
);

module.exports = router;
