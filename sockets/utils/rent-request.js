const RentRequest = require('../../models/RentRequest')
const Account = require('../../models/Account')
const { ObjectId } = require('mongoose').Types

// refactored rent container code
const getRentRequest = async (rentRequestId) => {
  return await RentRequest.findById(rentRequestId)
}

const getActiveRentRequestByDriver = async (driverId) => {
  return await RentRequest.findOne({
    driver: ObjectId(driverId),
    active: true,
    status: "IN_REQUEST"
  }).populate('vehicleType', 'rentPerHour rentPerDay rentPerDay')
}

const getActiveRentRequestByDriverAndPassenger = async (driverId, passengerId) => {
  return await RentRequest.findOne({
    driver: ObjectId(driverId),
    passenger: ObjectId(passengerId),
    active: true,
    status: "IN_REQUEST"
  })
}

const getActiveRentRequestByPassenger = async (passengerId) => {
  return await RentRequest.findOne({
    passenger: ObjectId(passengerId),
    active: true,
    status: "IN_REQUEST"
  })
}

const getActiveRentRequestByDispatcher = async (dispatcherId) => {
  return await RentRequest.findOne({
    dispatcher: ObjectId(dispatcherId),
    active: true,
    status: "IN_REQUEST"
  })
}

const getActiveRentRequestsByDispatcher = async (dispatcherId) => {
  try {
    const dispatcher = await Account.findById(dispatcherId)

    if (dispatcher.tripSearchId && dispatcher.tripSearchId === "SINGLE_DRIVER_RENT") {
      return await RentRequest.find({
        dispatcher: ObjectId(dispatcherId),
        rentSearchId: null
        // status: "IN_REQUEST"
      }).sort({_id: -1 }).limit(1).populate('passenger').populate('driver').populate('vehicleType')
    }
    else if (dispatcher.rentSearchId)
      return await RentRequest.find({
        dispatcher: ObjectId(dispatcherId),
        tripSearchId: dispatcher.rentSearchId
        // status: "IN_REQUEST"
      }).populate('passenger').populate('driver').populate('vehicleType')
    else return []
  } catch (error) {
    console.log(error)
  }
}

const updateRentRequest = (rentRequestId) => async (changes) => {
  try {
    return await RentRequest.updateOne({ _id: ObjectId(rentRequestId) }, changes)
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  getRentRequest,
  updateRentRequest,
  getActiveRentRequestByDriver,
  getActiveRentRequestByDispatcher,
  getActiveRentRequestsByDispatcher,
  getActiveRentRequestByPassenger,
  getActiveRentRequestByDriverAndPassenger
}
