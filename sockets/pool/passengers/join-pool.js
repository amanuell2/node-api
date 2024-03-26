const { emitToPassenger, updatePassenger } = require('../../utils/passenger')
const Pool = require('../../../models/Pool')
const { emitToDriver } = require('../../utils/driver')
const { ObjectId } = require('mongoose').Types

const { sanitizeInputs } = require('../../utils/core')
const POOL_STATUS = require('../../../constants/pool-statuses')

const schema = {
  type: "object",
  properties: {
    poolId: { type: "string" },
    location: { type: "object" },
  },
  required: ['poolId', 'location'],
  additionalProperties: false
}

module.exports = async (data, passenger, socket) => {

  try {
    await sanitizeInputs(schema, data)

    // if ((await User.findById(id)).inActivePool) {
    if (passenger.inActivePool) {
      console.log("you are already in active pool")
      socket.emit('error', {
        type: 'pool',
        message: 'you already are in active pool'
      })
      return
    }

    const pool = await Pool.findOne({ _id: ObjectId(data.poolId), status: POOL_STATUS.CREATED }).populate('passengers', 'firstName lastName rating phoneNumber position socketId').populate('vehicle').populate('vehicleType').populate('driver').populate('trips')

    if (!pool) {
      console.log("GOT HERE")
      await updatePassenger(passenger._id)({
        inActivePool: false,
        poolId: null,
        position: data.location
      })

      socket.emit('error', {
        type: 'pool',
        message: 'pool does not exist'
      })
      return
    }

    try {
      pool.passengers.push(passenger._id)
      await pool.save()

      await updatePassenger(passenger._id)({ inActivePool: true, poolId: data.poolId })
      // socket.emit('pool', pool)
      console.log('joined successfully')

      // console.log("POOL =>> ", pool)

      const updatedPool = await Pool.findById(pool._id).populate('passengers', 'firstName lastName rating phoneNumber position socketId').populate('vehicle').populate('vehicleType').populate('driver').populate('trips')

      await emitToDriver(updatedPool.driver._id)('pool', updatedPool)
      updatedPool.passengers.forEach(async passenger => {
        await emitToPassenger(passenger._id)('pool', updatedPool)
      })
    } catch (err) {
      console.log(err)
      socket.emit('error', {
        type: 'pool',
        message: err.message
      })
    }
  } catch (error) {
    console.log(error)
  }

}
