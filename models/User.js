const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MODELS = require('../constants/model-names')
const { customAlphabet } = require('nanoid')
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 6)

const userSchema = Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: false
  },
  email: {
    type: String,
    required: false
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  profileImage: {
    type: String,
    required: false,
    default: null
  },
  emergencyContactNumber: {
    type: String,
    required: false
  },
  rating: {
    type: Number,
    default: 0.0
  },
  favoritePlaces: [
    {
      type: Schema.Types.ObjectId,
      ref: 'FavoritePlaces'
    }
  ],
  balance: {
    type: Number,
    default: 0
  },
  inActivePool: Boolean,
  poolId: String,
  socketId: String,
  position: {
    lat: Number,
    long: Number
  },
  fcm: String,
  inviteCode: String,
  gender: {
    type: String,
    default: "MALE"
  }
},
{
  timestamps: true
})

userSchema.statics.createWithInviteCode = async function(data) {
  // data.inviteCode = 'a';
  data.inviteCode = nanoid();

  let attempt = 10
  while (attempt > 0) {

  try {
    return await this.create(data);
  } catch (error) {
    if (error.code == 11000 && error.keyValue && error.keyValue.inviteCode) {
      console.log("captured")
      attempt -= 1
    } else {
      throw error
    }
  }
}
throw new Error("please try again")

};

userSchema.index(
  { inviteCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      inviteCode: { $exists: true },
    }
  }
)

module.exports = mongoose.model(MODELS.USERS, userSchema)
