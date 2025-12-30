import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../model/userModel.js";

export default function(passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists
          let user = await User.findOne({ username: profile.emails[0].value });

          if (user) {
            return done(null, user);
          }

          // Create new user
          user = await User.create({
            name: profile.displayName,
            username: profile.emails[0].value,
            phoneNo: 0, // Optional
            password: Math.random().toString(36).slice(-8), // Random password
            verified: true, // Auto-verify Google users
            role: "user",
          });

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
}