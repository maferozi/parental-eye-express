const { User } = require("../models");
const { generateHash, compare } = require("../helper/hash");
const { generateToken, verifyToken, decode } = require("../helper/jwt");
const { resetPasswordEmail } = require("../email/resetPassword");
const { sendMail } = require("../helper/mail");
const { ne } = require("faker/lib/locales");
const path = require("path");
const { verifyEmailTemplate } = require("../email/verifyEmail");
const logoPath = path.join(__dirname, '../public/logo.webp');


const BACKEND_URL = process.env.BACKEND_URL ;
const EMAIL_USER = process.env.EMAIL_USER ;


const signUp = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    if (!firstName || !lastName || !email || !password) {
      const error = new Error();
      error.message = "All fields are required";
      error.status = 400;
      throw error;
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      const error = new Error();
      error.message = "User with this email already exists";
      error.status = 400;
      throw error;
    }

    const hashedPassword = await generateHash(password);

    const newUser = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: role || 2,
    });

    const verificationToken = generateToken({ email }, '24h');
    const verificationUrl = `${req?.headers?.origin}/auth/verify-email/${verificationToken}`;
    newUser.verifyToken = verificationToken;
    await newUser.save();

    await sendMail({
      from: `Support Parental Eye`,
      to: newUser.email,
      subject: "Verify Your Email",
      html: verifyEmailTemplate(`${newUser.firstName} ${newUser.lastName}`, verificationUrl),
    });
    

    res.status(201).json({ message: "Account Created. Verification email sent please verify your email to login", user: newUser });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

const loginController = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      const error = new Error("User not found");
      error.status = 404;
      throw error;
    }

    if (!user.isVerifyEmail) {
      const verificationToken = generateToken({ email }, '24h');
      const verificationUrl = `${req?.headers?.origin}/auth/verify-email/${verificationToken}`;
      user.verifyToken = verificationToken;
      await user.save();

      await sendMail({
        from: `Support Parental Eye`,
        to: user.email,
        subject: "Verify Your Email",
        html: verifyEmailTemplate(`${user.firstName} ${user.lastName}`, verificationUrl),
      });
      

      const error = new Error('Please Verify Your Email First From Your Email Inbox');
      error.statusCode = 409;
      throw error;
    }

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      const error = new Error("Invalid password");
      error.status = 400;
      throw error;
    }

    const token = generateToken(user.toJSON(), '1h');
    const refreshToken = generateToken(user.toJSON(), "7d");

    res.status(200).json({
      message: "Login successful",
      token: { token, refreshToken },
    });
  } catch (error) {
    console.error("Error during login:", error);
    next(error);
  }
};

const me = (req, res, next) => {
  try {
    if (!req.user) {
      const error = new Error("User not authenticated");
      error.status = 401;
      throw error;
    }
    res.status(200).json({ message: "this is me", user: req.user });
  } catch (error) {
    next(error);
  }
};

const getRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const tokenData = await verifyToken(refreshToken);

    const user = await User.findByPk(tokenData.id).catch(() => null);
    if (!user) {
      return next(createError(400, "Invalid refresh token!"));
    }

    // Remove `exp` before generating a new token
    const { exp, ...cleanTokenData } = tokenData;


    const newToken = generateToken(user.toJSON(), '1h');
    const newRefreshToken = generateToken(user.toJSON(), "7d"); // 1 day

    return res.status(200).json({ token: newToken, refreshToken: newRefreshToken });
  } catch (err) {
    return next(err);
  }
};
const forgotPassword = async (req, res, next) => {
  try {
    const email = req.body?.email;

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = generateToken({ email }, '1h');
    await user.update({ forgetToken: resetToken });
    const resetUrl = `${req?.headers?.origin}/auth/forget/${resetToken}`;

    user.forgetToken = resetToken;
    await user.save();

    await sendMail({
      from: `Support Parental Eye`,
      to: user.email,
      subject: "Reset Your Password",
      html: resetPasswordEmail(`${user.firstName} ${user.lastName}`, resetUrl),
    });
    

    return res
      .status(200)
      .send({ message: "Reset passwrod URL is send to Your mail" });
  } catch (error) {
    return next(error);
  }
};

const setPassword = async (req, res, next) => {
  try {
    const passwordToken = req.body.token;

    const newPassword = req.body?.newPassword;

    const tokenData = await verifyToken(passwordToken);

    const user = await User.findOne({ where: { email: tokenData.email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user?.forgetToken !== passwordToken) {
      const error = new Error('invalid_token');
      error.statusCode = 409;
      throw error;
    }
    const pass = await generateHash(newPassword);
    user.password = pass
    user.forgetToken = null;

    await user.save();

    return res
      .status(200)
      .send({ message: "Password reset Sucessfully" });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: 'token_expired' });
    }
    return next(error);
  }
};

const getAdminParent = async (req, res, next) => {
  try {
    const user = await User.findAll({ where: { role: 2 } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ message: "Admin Parent",data:user });
  } catch (error) {
    return next(error);
  }
} 

const verifyEmailToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const decoded = decode(token);
    const email = decoded.email;
    // Find user by token
    if (!email) {
      return next({ message: "Invalid Token" });
    }
    
    // Find user by email
    const user = await User.findOne({
      where: { email },
    });

    if (!user) {
      return next({ message: "User not found" });
    }

    if (user.verifyToken !== token) {
      return next({ message: "Invalid or Expired Token" });
    }



    // Update user fields
    user.isVerifyEmail = true;
    user.verifyToken = null;
    await user.save();

    res.json({ message: "Email Verified Successfully!" });
  } catch (error) {
    return next(error);
  }
};


module.exports = { signUp, loginController, me, getRefreshToken, forgotPassword, setPassword, getAdminParent, verifyEmailToken };
