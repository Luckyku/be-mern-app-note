require("dotenv").config();
const config = process.env.CONNECTION_STRING;
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("./utilities");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const app = express();

// Connect to MongoDB
mongoose
  .connect(config.connectionString)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Import model
const User = require("./models/user.model");
const Note = require("./models/note.model");

app.use(express.json());

app.use(cors({ origin: "*" }));

// Create an account
app.post(
  "/create-account",
  [
    body("fullName")
      .notEmpty()
      .withMessage("Full name is required")
      .matches(/^[A-Za-z\s']+$/)
      .withMessage("Full name must not contain numbers"),
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email format"),
    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 5, max: 25 })
      .withMessage("Password must be between 5 and 25 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: true,
        message: "Validation error",
        details: errors.array(),
      });
    }
    const { fullName, email, password } = req.body;

    try {
      const isUser = await User.findOne({ email });

      if (isUser) {
        return res.status(400).json({
          error: true,
          message: "User already exists",
        });
      }
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
        fullName,
        email,
        password: hashedPassword,
      });
      await user.save();

      const accessToken = jwt.sign({ user }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      return res.json({
        error: false,
        user,
        accessToken,
        message: "Registration Successful",
      });
    } catch (err) {
      console.error("Error during account creation:", err);
      return res
        .status(500)
        .json({ error: true, message: "Internal Server Error" });
    }
  }
);

// Attemp Login
app.post(
  "/login",
  [
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email format"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: true,
        message: "Validation error",
        details: errors.array(),
      });
    }
    const { email, password } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ error: true, message: "Email is required" });
    }
    if (!password) {
      return res
        .status(400)
        .json({ error: true, message: "Password is required" });
    }
    try {
      const userInfo = await User.findOne({ email: email });

      if (!userInfo) {
        return res
          .status(400)
          .json({ error: true, message: "User not found, check your email" });
      }

      // Check if password matches
      const passwordMatch = await bcrypt.compare(password, userInfo.password); // **Hashing comparison**

      if (userInfo.email == email && passwordMatch) {
        const user = { user: userInfo };
        const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1h",
        });
        return res.status(200).json({
          error: false,
          message: "Login Successfull",
          email,
          accessToken,
        });
      } else {
        return res.status(400).json({
          error: true,
          message: "Invalid Credential",
        });
      }
    } catch (error) {
      console.error("Error during login:", error);
      return res
        .status(500)
        .json({ error: true, message: "Internal Server Error" });
    }
  }
);

// Get User
app.get("/get-user", authenticateToken, async (req, res) => {
  const { user } = req.user;

  try {
    const isUser = await User.findOne({ _id: user._id });
    if (!isUser) {
      return res.status(401);
    }

    return res.json({
      error: false,
      user: {
        FullName: isUser.fullName,
        email: isUser.email,
        _id: isUser._id,
        createdOn: isUser.createdOn,
      },
      message: "User retrieved successfully",
    });
  } catch (error) {
    // Log the error for debugging purposes
    console.error("Error retrieving user:", error);

    // Respond with a 500 status for internal server errors
    return res.status(500).json({
      error: true,
      message: "An error occurred while retrieving user data.",
    });
  }
});

// Add Notes
app.post(
  "/add-notes",
  authenticateToken,
  [
    // Validate and sanitize inputs
    body("title")
      .isLength({ max: 225 })
      .withMessage("Title must be less than 225 characters"),
    body("tags")
      .isArray()
      .withMessage("Tags must be an array")
      .custom((tags) =>
        tags.every(
          (tag) => typeof tag === "string" && tag.length < 25 && !/\s/.test(tag)
        )
      )
      .withMessage(
        "Invalid tags format, tags should be without spacing and less than 25 characters"
      ),
    body("content").notEmpty().withMessage("Content is required"),
  ],
  async (req, res) => {
    // Handle validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: true,
        message: "Validation error",
        details: errors.array(),
      });
    }
    const { title, content, tags } = req.body;
    const { user } = req.user;
    if (!title) {
      return res
        .status(400)
        .json({ error: true, message: "Title is required" });
    }
    if (!content) {
      return res
        .status(400)
        .json({ error: true, message: "Content is required" });
    }

    try {
      const note = new Note({
        title,
        content,
        tags: tags || [],
        userId: user._id,
      });
      await note.save();
      return res.status(201).json({
        error: false,
        note,
        message: "New note has been created",
      });
    } catch (error) {
      return res.status(500).json({
        error: true,
        message: "Internal Server Error",
      });
    }
  }
);

//Edit Notes
app.put(
  "/edit-notes/:noteId",
  authenticateToken,
  [
    // Validate and sanitize inputs
    body("title")
      .isLength({ max: 225 })
      .withMessage("Title must be less than 225 characters"),
    body("tags")
      .isArray()
      .withMessage("Tags must be an array")
      .custom((tags) =>
        tags.every(
          (tag) => typeof tag === "string" && tag.length < 25 && !/\s/.test(tag)
        )
      )
      .withMessage(
        "Invalid tags format, tags should be without spacing and less than 25 characters"
      ),
    body("content").notEmpty().withMessage("Content is required"),
  ],
  async (req, res) => {
    // Handle Validation result 
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: true,
        message: "Validation error",
        details: errors.array(),
      });
    }

    const noteId = req.params.noteId;
    const { title, content, tags, isPinned } = req.body;
    const { user } = req.user;

    if (!title && !content && !tags) {
      return res
        .status(400)
        .json({ error: true, message: "No Changes Provided" });
    }
    try {
      const note = await Note.findOne({ _id: noteId, userId: user._id });
      if (!note) {
        return res
          .status(400)
          .json({ error: true, message: "Notes not found" });
      }
      if (title) note.title = title;
      if (content) note.content = content;
      if (tags) note.tags = tags;
      if (isPinned) note.isPinned = isPinned;

      await note.save();
      return res.json({ error: false, note, message: "Note has been updated" });
    } catch (error) {
      return res.status(500).json({
        error: true,
        message: "Internal server error",
      });
    }
  }
);

// Get all notes
app.get("/get-all-notes", authenticateToken, async (req, res) => {
  const { user } = req.user;
  try {
    const notes = await Note.find({ userId: user._id }).sort({ isPinned: -1 });
    return res.json({
      error: false,
      notes,
      message: "All notes retrieved successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
});

// Delete a note
app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { user } = req.user;
  try {
    const note = await Note.findOne({ userId: user._id, _id: noteId });
    if (!note) {
      return res.status(400).json({
        error: true,
        message: "Note not found",
      });
    }
    await Note.deleteOne({
      _id: noteId,
      userId: user._id,
    });
    return res.json({
      error: false,
      message: "Note deleted successfully",
    });
  } catch (error) {
    return res.status(400).json({
      error: true,
      message: "Note not found",
    });
  }
});

// Update is pinned
app.put(
  "/update-note-ispinned/:noteId",
  authenticateToken,
  async (req, res) => {
    const noteId = req.params.noteId;
    const { isPinned } = req.body;
    const { user } = req.user;

    // Check if isPinned is provided
    if (isPinned === undefined) {
      return res.status(400).json({
        error: true,
        message: "No changes provided",
      });
    }
    try {
      const note = await Note.findOne({ _id: noteId, userId: user._id });

      // Handle case where note is not found
      if (!note) {
        return res.status(404).json({
          error: true,
          message: "Note not found",
        });
      }

      note.isPinned = isPinned || false;

      await note.save();

      return res.json({
        error: false,
        note,
        message: "Note pinned change successfully",
      });
    } catch (error) {
      return res.status(500).json({
        error: true,
        message: "Internal server error",
      });
    }
  }
);

// Search note
app.get("/search-notes/", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({
      error: true,
      message: "Search query is needed!",
    });
  }

  try {
    const matchingNote = await Note.find({
      userId: user._id,
      $or: [
        { title: { $regex: new RegExp(query, "i") } },
        { content: { $regex: new RegExp(query, "i") } },
      ],
    });
    return res.json({
      error: false,
      notes: matchingNote,
      message: "Search notes successfully retrieved",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

app.listen(8000, () => {
  console.log("Server is running on port 8000");
});

module.exports = app;
