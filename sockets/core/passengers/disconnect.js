const passengerTasks = require('../../../jobs/passenger')
const TripSearch = require('../../../models/TripSearch')
const { extractPassengerFromToken } = require("../../utils/passenger")
const { ObjectId } = require('mongoose').Types

const redis = require("redis");
const bluebird = require('bluebird');
bluebird.promisifyAll(redis.RedisClient.prototype);
const redisClient = redis.createClient({ host: 'ilift-redis-refactored', port: 6379 });

module.exports = async (data, passenger, socket) => {
    console.log('DISCONNECTING>>>>>>')
    // removeUser({ fcm }); // TODO: implement this on db
    const profileData = await extractPassengerFromToken(socket)
    if (socket.handshake && socket.handshake.query && socket.handshake.query.token && socket.handshake.query.id) {
      try{
      await redisClient.delAsync('ps-' + socket.handshake.query.id)
      } catch(e) {
        console.log("eeeee")
        console.log(e)
      }
    }
    if (profileData) { // Note: if passengers fail auth profileData will be undefined - i.e: can't access _id field
      await passengerTasks.stopFetchNearByDrivers({ id: profileData._id })
    }

    // const activeTripSearchingTask = await TripSearch.find({
    //   passenger: ObjectId(passenger._id)
    // })

    // for (const task of activeTripSearchingTask) {
    //   console.log(">><<<<<<<< cancelling task")
    //   task.status = "CANCELLED"
    //   task.active = false
      
    //   await task.save()
    //   if (!task.dispatcher)
    //     await passengerTasks.stopSearchingForRides(task) 
    // }
  }