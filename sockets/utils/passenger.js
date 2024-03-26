const User = require('../../models/User')
const Token = require('../../models/Token')
const { sendNotification } = require('../../services/notificationService')
const { ObjectId } = require('mongoose').Types

const redis = require("redis");
const bluebird = require('bluebird')
bluebird.promisifyAll(redis.RedisClient.prototype);
const redisClient = redis.createClient({ host: 'ilift-redis-refactored', port: 6379 });

const { getIO } = require('../io')

const io = getIO()

const getPassenger = async (passengerId, projection) => {
  return await User.findById(passengerId, projection)
}

// refactored driver container code
const emitToPassenger = (passengerId) => async (event, data) => {
  const passenger = await User.findById(passengerId)
  if (passenger.socketId) {
    io.of('/passenger-socket').to(passenger.socketId).emit(event, data)
  } else {
    console.log(passenger._id, '- not socket ID found')
  }
}

const notifyPassenger = (passengerId) => async (data) => {
  const passenger = await User.findById(passengerId)
  if (passenger.fcm)
    sendNotification(passenger.fcm, data)
  else {
    console.log(passenger._id,'- no FCM found')
  }
}

const updatePassenger = (passengerId) => async (changes) => {
  try {
    await User.updateOne({ _id: ObjectId(passengerId) }, changes)
    await redisClient.setAsync('ps-'+passengerId, JSON.stringify(await User.findById(passengerId)), 'EX', 3600);
  } catch (error) {
    console.log(error)
  }
}

async function extractPassengerFromToken(socket) {
  if (socket.handshake && socket.handshake.query && socket.handshake.query.token && socket.handshake.query.id) {
    const { token, id } = socket.handshake.query

    let value = await redisClient.getAsync('ps-'+id);
    value = value !== 'undefined' && JSON.parse(value) || null;
    if (!value) {
      try {
        const persistedToken = await Token.findById(token).populate('passenger')
        if (persistedToken && persistedToken.passenger) {
          await Token.deleteMany({
            passenger: persistedToken.passenger._id,
            _id: { $ne: persistedToken._id }
          })
          value = persistedToken.passenger
          await redisClient.setAsync('ps-'+id, JSON.stringify(value), 'EX', 3600);
        } else {
          throw new Error("unauthorized")
        }
      } catch (e) {
        console.log(e)
        throw e
      }
    }
    return value
  } else {
    throw new Error("unauthorized")
  }
}

module.exports = {
  getPassenger,
  emitToPassenger,
  notifyPassenger,
  updatePassenger,
  extractPassengerFromToken
}
