const { extractPassengerFromToken } = require('./utils/passenger')

const redis = require("redis");
const bluebird = require('bluebird');
const Token = require('../models/Token');
bluebird.promisifyAll(redis.RedisClient.prototype);
const redisClient = redis.createClient({ host: 'ilift-redis-refactored', port: 6379 });
const { ObjectId } = require('mongoose').Types;
const Passenger = require('../models/User');

module.exports = async (socket) => {

  if (socket.handshake && socket.handshake.query && socket.handshake.query.token && socket.handshake.query.id) {
    const { token, id } = socket.handshake.query

    try {
      const persistedToken = await Token.findOne({ _id: ObjectId(token), active: true })


      if (persistedToken && persistedToken.passenger) {

        const passenger = await Passenger.findOne({
          _id: persistedToken.passenger
        })

        passenger.socketId = socket.id
        await passenger.save()

        await redisClient.setAsync(`ps-`+ id, JSON.stringify(passenger), 'EX', 3600);

        await Token.deleteMany({
          passenger: persistedToken.passenger,
          _id: { $ne: persistedToken._id }
        })

      }
    } catch (e) {
      console.log(e)
    }

  }

  const registerSocketHandler = (moduleName) => async data => {
    try {
      const profileData = await extractPassengerFromToken(socket)
      console.log(`[SOCKET] bootstraping: ${moduleName} ...`)
      return profileData ? require(moduleName)(data, profileData, socket) : () => { }
    } catch (error) {
      console.log(error)
      socket.emit('unauthorized')
    }
  }

  // core
  socket.on('init', registerSocketHandler('./core/passengers/init'))
  socket.on('changeLocation', registerSocketHandler('./core/passengers/change-location'))
  socket.on('search', registerSocketHandler('./core/passengers/search'))
  socket.on('cancelRequest', registerSocketHandler('./core/passengers/cancel-request'))

  // // pool
  // socket.on('nearByPools', registerSocketHandler('./pool/passengers/nearby-pools'))
  // socket.on('leavePool', registerSocketHandler('./pool/passengers/leave-pool'))
  // socket.on('joinPool', registerSocketHandler('./pool/passengers/join-pool'))

  // pool
  socket.on('sendMessagePool', registerSocketHandler('./pool/passengers/send-message'))
  socket.on('cancelPoolRequest', registerSocketHandler('./pool-search/passengers/cancel-search'))

  // trip
  socket.on('cancelTrip', registerSocketHandler('./trip/passengers/cancel-trip'))

  // rent
  socket.on('cancelRent', registerSocketHandler('./rent/passengers/cancel-rent'))
  socket.on('rent', registerSocketHandler('./rent/passengers/rent'))
  socket.on('cancelRentRequest', registerSocketHandler('./rent/passengers/cancel-rent-request'))

  socket.on('disconnect', registerSocketHandler('./core/passengers/disconnect'))
}
