import { model, Schema } from 'mongoose';
import { LoginAttempt, Role } from 'src/entity';

const LoginAttemptSchema = new Schema<LoginAttempt>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: Role,
      required: true,
    },
    deviceToken: String,
    isSuccess: {
      type: Boolean,
      default: false,
    },
    ip: String,
    platform: String,
    timezone: String,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

LoginAttemptSchema.index({ createdAt: -1 });
const LoginAttemptModel = model<LoginAttempt>('login-attempts', LoginAttemptSchema);
export { LoginAttemptModel };
