const Trip = require('../../models/Ride')
const { ObjectId } = require('mongoose').Types

// refactored trip container code
const getTrip = async (tripId) => {
  return await Trip.findById(tripId)
}

const updateTrip = (tripId) => async (changes) => {
  try {
    return await Trip.updateOne({ _id: ObjectId(tripId) }, changes)
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
    getTrip,
    updateTrip
}
