const { updateVehicle } = require('../../utils/vehicle')
const redis = require("redis");
const bluebird = require('bluebird')
bluebird.promisifyAll(redis.RedisClient.prototype);
const redisClient = redis.createClient({ host: 'ilift-redis-refactored', port: 6379 });

module.exports = async (driverInfo, driver, vehicle, socket) => {
  try {
    if (vehicle) {
      // TODO: cancel active requests for this driver
      await updateVehicle(vehicle._id)({ online: false, statusChangedIntentionally: vehicle.online ? false : vehicle.statusChangedIntentionally })

      if (socket.handshake && socket.handshake.query && socket.handshake.query.token && socket.handshake.query.id) {
        await redisClient.delAsync('dr-' + socket.handshake.query.id)
      }
    }
    // console.log('Driver disconnected', driver._id)
  } catch (error) {
    console.log('error on disconnect ', error)
  }
}
