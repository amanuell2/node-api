const TripRequest = require('../../models/TripRequest')
const Account = require('../../models/Account')
const { ObjectId } = require('mongoose').Types

// refactored trip container code
const getTripRequest = async (tripRequestId) => {
  return await TripRequest.findById(tripRequestId)
}

const getActiveRequestByDriver = async (driverId) => {
  return await TripRequest.findOne({
    driver: ObjectId(driverId),
    active: true,
    status: "IN_REQUEST"
  }).populate("passenger")
}

const getActiveRequestByDriverAndPassenger = async (driverId, passengerId) => {
  return await TripRequest.findOne({
    driver: ObjectId(driverId),
    passenger: ObjectId(passengerId),
    active: true,
    status: "IN_REQUEST"
  })
}

const getActiveRequestByPassenger = async (passengerId) => {
  return await TripRequest.findOne({
    $or: [
      {
        passenger: ObjectId(passengerId),
      },
      {
        orderedBy: ObjectId(passengerId)
      }
    ], active: true,
    status: "IN_REQUEST"
  })
}

const getActiveRequestByDispatcher = async (dispatcherId) => {
  return await TripRequest.findOne({
    dispatcher: ObjectId(dispatcherId),
    active: true,
    status: "IN_REQUEST"
  })
}

const getActiveRequestsByDispatcher = async (dispatcherId) => {
  try {

    const dispatcher = await Account.findById(dispatcherId)

    if (dispatcher.tripSearchId && dispatcher.tripSearchId === "SINGLE_DRIVER") {
      return await TripRequest.find({
        dispatcher: ObjectId(dispatcherId),
        tripSearchId: null
        // status: "IN_REQUEST"
      }).sort({ _id: -1 }).limit(1).populate('passenger').populate('driver').populate('vehicleType')
    }
    else if (dispatcher.tripSearchId)
      return await TripRequest.find({
        dispatcher: ObjectId(dispatcherId),
        tripSearchId: dispatcher.tripSearchId
        // status: "IN_REQUEST"
      }).populate('passenger').populate('driver').populate('vehicleType')
    else return []
  } catch (error) {
    console.log(error)
  }
}

const updateTripRequest = (tripRequestId) => async (changes) => {
  try {
    return await TripRequest.updateOne({ _id: ObjectId(tripRequestId) }, changes)
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  getTripRequest,
  updateTripRequest,
  getActiveRequestByDriver,
  getActiveRequestByDispatcher,
  getActiveRequestsByDispatcher,
  getActiveRequestByPassenger,
  getActiveRequestByDriverAndPassenger
}
