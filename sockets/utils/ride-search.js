const TripSearch = require('../../models/TripSearch')
const { ObjectId } = require('mongoose').Types

// refactored trip container code
const getTripSearch = async (tripSearchId) => {
  return await TripSearch.findById(tripSearchId)
}

const updateTripSearch = (tripSearchId) => async (changes) => {
  try {
    return await TripSearch.findByIdAndUpdate(tripSearchId, changes)
  } catch (error) {
    console.log(error)
  }
}

const getActiveTripSearchByDispatcher = async (tripSearchId) => {
  try {

    return await TripSearch.findOne({
      _id: ObjectId(tripSearchId),
      // status: "IN_REQUEST"
    }).populate('passenger').populate('driver').populate('vehicleType')
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
    getTripSearch,
    updateTripSearch,
    getActiveTripSearchByDispatcher,
}
