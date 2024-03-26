const Pool = require('../../models/Pool')
const { ObjectId } = require('mongoose').Types

// refactored pool container code
const getPool = async (poolId) => {
  return await Pool.findById(poolId)
}

const updatePool = (poolId) => async (changes) => {
  try {
    return await Pool.updateOne({ _id: ObjectId(poolId) }, changes)
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  getPool,
  updatePool
}
