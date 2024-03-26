const PoolSearch = require('../../models/PoolSearch')
const { ObjectId } = require('mongoose').Types

// refactored pool container code
const getPoolSearch = async (poolSearchId) => {
  return await PoolSearch.findById(poolSearchId)
}

const updatePoolSearch = (poolSearchId) => async (changes) => {
  try {
    return await PoolSearch.findByIdAndUpdate(poolSearchId, changes)
  } catch (error) {
    console.log(error)
  }
}

const getActivePoolSearchByDispatcher = async (poolSearchId) => {
  try {

    return await PoolSearch.findOne({
      _id: ObjectId(poolSearchId),
      // status: "IN_REQUEST"
    }).populate('passenger').populate('driver').populate('vehicleType')
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
    getPoolSearch,
    updatePoolSearch,
    getActivePoolSearchByDispatcher,
}