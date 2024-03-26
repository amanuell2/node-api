const { emitToPassenger, updatePassenger } = require('../../utils/passenger')
const Pool = require('../../../models/Pool')
const { emitToDriver } = require('../../utils/driver')
const { ObjectId } = require('mongoose').Types
const { sanitizeInputs } = require('../../utils/core')
const POOL_STATUS = require('../../../constants/pool-statuses')

const schema = {
  type: "object",
  properties: {
  },
  required: [],
  additionalProperties: false
}


module.exports = async (data, passenger, socket) => {

  try {
    // await sanitizeInputs(schema, data)


    if (!passenger.inActivePool) {
      socket.emit('error', {
        type: 'pool',
        message: 'you are not in a pool'
      })
    } else {
      const pool = await Pool.findById(passenger.poolId).populate('passengers', 'firstName lastName rating phoneNumber position socketId').populate('vehicle').populate('vehicleType').populate('driver').populate('trips')

      if (pool.status === POOL_STATUS.STARTED) {
        socket.emit('error', {
          type: 'pool',
          message: "you can't leave a started pool"
        })
        return
      }

      await pool.passengers.pull({ _id: ObjectId(passenger._id) })

      await pool.save()

      await updatePassenger(passenger._id)({
        inActivePool: false,
        poolId: null
      })
      // passenger.inActivePool = false;
      // passenger.poolId = null;
      // await passenger.save()

      console.log('<>', pool.driver)
      emitToDriver(pool.driver._id)('pool', pool)
      pool.passengers.forEach(member => {
        emitToPassenger(member._id)('pool', pool)
      })
      socket.emit('leftFromPool')
    }
  } catch (error) {
    console.log(error)
  }
}
