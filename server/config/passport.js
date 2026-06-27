const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const User = require("../models/User");
const Patient = require("../models/Patient");

// Local strategy: used at /api/auth/login to validate email + password
passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email }).select("+password");
        if (!user) {
          return done(null, false, { message: "Invalid credentials" });
        }
        if (!user.password) {
          return done(null, false, { message: "This account uses Google sign-in. Please use 'Continue with Google'." });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return done(null, false, { message: "Invalid credentials" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(null, false, { message: "No email from Google" });

        let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });

        if (user) {
          // Link Google ID if the account was originally created with email/password
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
          return done(null, { user, isNew: false });
        }

        // First-time Google sign-in → create patient account by default
        user = await User.create({
          name: profile.displayName,
          email,
          googleId: profile.id,
          role: "patient",
        });
        await Patient.create({ userId: user._id });

        return done(null, { user, isNew: true });
      } catch (err) {
        return done(err);
      }
    }
  )
);

// JWT strategy: used to protect routes via Authorization: Bearer <token>
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    async (payload, done) => {
      try {
        const user = await User.findById(payload.id);
        if (!user) return done(null, false);
        return done(null, user);
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

module.exports = passport;
