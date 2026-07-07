import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
  token: { type: String, required: true },
  userId: { type: String, required: true },
  expiresAt: { type: Date, default: Date.now },
});

export const Session = mongoose.model("Session", SessionSchema);
