import user from "../model/userModel.js";
import bcrypt from "bcryptjs";
import asyncErrorHandler from "../utils/asyncErrorHandler.js";
import jwt from "jsonwebtoken";
import { CustomError } from "../utils/customerError.js";
import sendEmail from "../utils/sendEmail.js";
import crypto from "crypto";

const singToken = (id, name) => {
  return jwt.sign({ id, name }, process.env.JWT_SECRET, {
    expiresIn: "1hr",
  });
};

const registerUser = asyncErrorHandler(async (req, res, next) => {
  const { name, username, phoneNo, password, role } = req.body;
  // console.log(username);
  // check validation
  if (!name) {
    const error = new CustomError("Enter the user name", 404);
    return next(error);
  }
  if (!password || password.length < 8) {
    const error = new CustomError("2", 404);
    return next(error);
  }
  const exits = await user.findOne({ username });
  if (exits) {
    const error = new CustomError("3", 404);
    return next(error);
  }
  bcrypt.genSalt(10, function (err, salt) {
    if (err) {
      const error = new CustomError("Hash error", 404);
      return next(error);
    }
    bcrypt.hash(password, salt, async function (err, hash) {
      if (err) {
        const error = new CustomError("Hash error", 404);
        return next(error);
      }
      // Store hash in your password DB.
      const userCreate = await user.create({
        name,
        username,
        phoneNo,
        password: hash,
        role,
      });

      res.status(201).send({ message: "ok" });
    });
  });
  //create the user
});

const verifyGmail = asyncErrorHandler(async (req, res, next) => {
  try {
    const token = req.params.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Update user's verified status
    await user.findByIdAndUpdate(decoded.userId, { verified: true });

    res.send("Email successfully verified.");
  } catch (error) {
    res.status(400).send("Invalid or expired token.");
  }
});

const loginUser = asyncErrorHandler(async (req, res, next) => {
  const { username, password } = req.body;
  const userFind = await user.findOne({ username });
  if (!userFind) {
    const error = new CustomError("Invalid Credentials", 404);
    return next(error);
  }
  if (userFind && !userFind.verified) {
    const error = new CustomError("verifiy your email", 404);
    return next(error);
  }

  if (userFind && !userFind.isActive) {
    const error = new CustomError("Not Allowed to access", 404);
    return next(error);
  }

  bcrypt.compare(password, userFind.password, async function (err, result) {
    if (err) {
      const error = new CustomError("Internal Server Error", 500);
      return next(error);
    }
    if (result) {
      const newUser = await user.findOne({ username }).select("-password");
      const token = singToken(userFind._id, userFind.username);
      res.cookie("token", token, {
        httpOnly: true,
        // domain: 'localhost',
        path: "/",
        expires: new Date(Date.now() + 1000 * 86400),
        sameSite: "lax",
      }),
        res.status(200).json({ token, newUser });
    } else {
      const error = new CustomError("Invalid Credential", 500);
      return next(error);
    }
  });
});

const getUser = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user;
  let newuser;

  try {
    newuser = await user.findById(userId, "-password");
  } catch (err) {
    const error = new CustomError("Login again..", 500);
    return next(error);
  }
  if (!newuser) {
    return res.status(404).json({ messsage: "User Not FOund" });
  }
  return res.status(200).json({ newuser });
});

const getAllDetailsUser = asyncErrorHandler(async (req, res, next) => {
  const userDetails = await user.find({});
  res.status(200).json(userDetails);
});

const logOutUser = asyncErrorHandler(async (req, res, next) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  }),
    res.status(200).json({ message: "log out" });
});
export {
  getUser,
  registerUser,
  loginUser,
  getAllDetailsUser,
  logOutUser,
  verifyGmail,
};

const forgotPassword = asyncErrorHandler(async (req, res, next) => {
  const { email } = req.body;

  const userFind = await user.findOne({ username: email });
  if (!userFind) {
    const error = new CustomError("User not found", 404);
    return next(error);
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Save token to user (you need to add these fields to your schema)
  userFind.resetPasswordToken = resetTokenHash;
  userFind.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  await userFind.save();

  // Create reset URL
  const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

  // Email message
  const message = `
    <h1>You requested a password reset</h1>
    <p>Please click the link below to reset your password:</p>
    <a href="${resetUrl}" clicktracking=off>${resetUrl}</a>
    <p>This link will expire in 10 minutes.</p>
  `;

  try {
    await sendEmail({
      to: userFind.username,
      subject: "Password Reset Request",
      html: message,
    });

    res.status(200).json({ message: "Email sent successfully" });
  } catch (err) {
    userFind.resetPasswordToken = undefined;
    userFind.resetPasswordExpire = undefined;
    await userFind.save();

    const error = new CustomError("Email could not be sent", 500);
    return next(error);
  }
});

const resetPassword = asyncErrorHandler(async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;

  // Hash the token from URL
  const resetTokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // Find user with valid token
  const userFind = await user.findOne({
    resetPasswordToken: resetTokenHash,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!userFind) {
    const error = new CustomError("Invalid or expired token", 400);
    return next(error);
  }

  // Validate password
  if (!password || password.length < 8) {
    const error = new CustomError("Password must be at least 8 characters", 400);
    return next(error);
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  // Update user
  userFind.password = hash;
  userFind.resetPasswordToken = undefined;
  userFind.resetPasswordExpire = undefined;
  await userFind.save();

  res.status(200).json({ message: "Password reset successful" });
});

export { forgotPassword, resetPassword };
