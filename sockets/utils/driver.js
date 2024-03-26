const Driver = require('../../models/Driver')
const Token = require('../../models/Token')
const { sendNotification } = require('../../services/notificationService')
const { ObjectId } = require('mongoose').Types
const { getIO } = require('../io')
const redis = require("redis");
const bluebird = require('bluebird')
bluebird.promisifyAll(redis.RedisClient.prototype);
const redisClient = redis.createClient({ host: 'ilift-redis-refactored', port: 6379 });

const io = getIO()

// refactored driver container code
const emitToDriver = (driverId) => async (event, data) => {
  const driver = await Driver.findById(driverId)
  io.of('/driver-socket').to(driver.socketId).emit(event, data)
}

const notifyDriver = (driverId) => async (data) => {
  const driver = await Driver.findById(driverId)
  sendNotification(driver.fcm, data)
}

const updateDriver = (driverId) => async (changes) => {
  try {
    await Driver.updateOne({ _id: ObjectId(driverId) }, changes)
    const previousDataInRedis = await redisClient.getAsync('dr-' + driverId)


    await redisClient.setAsync('dr-'+driverId, JSON.stringify({...((await Driver.findById(driverId))._doc), token: previousDataInRedis ? previousDataInRedis.token : undefined}), 'EX', 20);    
  } catch (error) {
    console.log(error)
  }
}

async function extractDriverFromToken(socket) {
  if (socket.handshake && socket.handshake.query && socket.handshake.query.token && socket.handshake.query.id) {
    const { token, id } = socket.handshake.query

    let value = await redisClient.getAsync('dr-' + id);
    value = value !== 'undefined' && JSON.parse(value) || null;
    if (!value) {
      try {
        // console.log("token", token)
        const persistedToken = await Token.findOne({ _id: ObjectId(token), active: true }).populate('driver')
        // console.log("perisisted token", JSON.stringify(persistedToken))
        if (persistedToken && persistedToken.driver) {

          await Token.deleteMany({
            driver: persistedToken.driver._id,
            _id: { $ne: persistedToken._id },
          })
          
          // value = persistedToken.driver
          value = {...persistedToken.driver._doc, token: persistedToken._id }

          // console.log("important:", {...value._doc, token: persistedToken._id })
          await redisClient.setAsync('dr-' + id, JSON.stringify(value), 'EX', 20);
          return value
        }
        else {
          // console.log("PLACE #1")
          throw new Error("unauthorized")

        }
      } catch (e) {
        throw e
      }
    }

    if (value) {
      if (!value.token) {
        const persistedToken = await Token.findOne({ _id: ObjectId(token), active: true }).populate('driver')
        if (persistedToken && persistedToken.driver) {

          await Token.deleteMany({
            driver: persistedToken.driver._id,
            _id: { $ne: persistedToken._id },
          })

          // value = persistedToken.driver
          value = {...persistedToken.driver._doc, token: persistedToken._id }
          
          // console.log("important:", {...value._doc, token: persistedToken._id })
          await redisClient.setAsync('dr-' + id, JSON.stringify(value), 'EX', 20);
          // return { ...value._doc, token: persistedToken._id }
          return value
        }
        else {
          // console.log("PLACE #2")

          throw new Error("unauthorized")
        }
      }
      if (value && value.token != socket.handshake.query.token) {
        // console.log("PLACE #3")

        throw new Error("unauthorized")
      } else {
        return value
      }
    }
  } else {
    // console.log("PLACE #4")
    // console.log("socket token", socket.handshake.query.token)
    // console.log("socket id", socket.handshake.query.id)

    throw new Error("unauthorized")
  }
}

module.exports = {
  emitToDriver,
  notifyDriver,
  updateDriver,
  extractDriverFromToken
}