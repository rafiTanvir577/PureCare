import { model, Schema, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { User, UserStatus } from 'src/entity/user.entity';
import { Role } from 'src/entity';

const UserSchema = new Schema<User>(
  {
    id: {
      type: String,
      unique: true,
      default: () => randomUUID(),
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
    },
    profile: {
      type: Object,
      default: null,
    },
    role: {
      type: String,
      enum: Role,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Number,
    password: String,
    features: [Types.ObjectId],
    admins: [String],
    firstName: String,
    lastName: String,
    status: {
      type: String,
      enum: UserStatus,
      default: UserStatus.ACTIVE,
    },
    setPasswordStatus: {
      type: String,
      default: 'Invitation sent',
    },
    invitationDate: Date,
    comment: String,
    isEmailVerified: { type: Boolean, default: false },
    setPasswordExpirationTime: Number,
    setPasswordToken: String,
    sessionId: String,
    deviceTokens: [String],
    emailVerificationToken: String,
    emailVerificationExpireTime: Number,
    tmpEmail: String,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const UserModel = model<User>('user', UserSchema);
export { UserModel };
