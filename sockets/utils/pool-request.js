const PoolRequest = require('../../models/PoolRequest')
const Account = require('../../models/Account')
const { ObjectId } = require('mongoose').Types

// refactored pool container code
const getPoolRequest = async (poolRequestId) => {
  return await PoolRequest.findById(poolRequestId)
}

const getActivePoolRequestByDriver = async (driverId) => {
  return await PoolRequest.findOne({
    driver: ObjectId(driverId),
    active: true,
    status: "IN_REQUEST"
  }).populate('passenger').populate('vehicleType')
}

const getActiveRequestByDriverAndPassenger = async (driverId, passengerId) => {
  return await PoolRequest.findOne({
    driver: ObjectId(driverId),
    passenger: ObjectId(passengerId),
    active: true,
    status: "IN_REQUEST"
  })
}

const getActivePoolRequestByPassenger = async (passengerId) => {
  return await PoolRequest.findOne({
    passenger: ObjectId(passengerId),
    active: true,
    status: "IN_REQUEST"
  })
}

const getActiveRequestByDispatcher = async (dispatcherId) => {
  return await PoolRequest.findOne({
    dispatcher: ObjectId(dispatcherId),
    active: true,
    status: "IN_REQUEST"
  })
}

const getActiveRequestsByDispatcher = async (dispatcherId) => {
  try {

    const dispatcher = await Account.findById(dispatcherId)

    if (dispatcher.poolSearchId && dispatcher.poolSearchId === "SINGLE_DRIVER") {
      return await PoolRequest.find({
        dispatcher: ObjectId(dispatcherId),
        poolSearchId: null
        // status: "IN_REQUEST"
      }).sort({_id: -1 }).limit(1).populate('passenger').populate('driver').populate('vehicleType')
    }
    else if (dispatcher.poolSearchId)
      return await PoolRequest.find({
        dispatcher: ObjectId(dispatcherId),
        poolSearchId: dispatcher.poolSearchId
        // status: "IN_REQUEST"
      }).populate('passenger').populate('driver').populate('vehicleType')
    else return []
  } catch (error) {
    console.log(error)
  }
}

const updatePoolRequest = (poolRequestId) => async (changes) => {
  try {
    return await PoolRequest.updateOne({ _id: ObjectId(poolRequestId) }, changes)
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  getPoolRequest,
  updatePoolRequest,
  getActivePoolRequestByDriver,
  getActiveRequestByDispatcher,
  getActiveRequestsByDispatcher,
  getActivePoolRequestByPassenger,
  getActiveRequestByDriverAndPassenger
}
