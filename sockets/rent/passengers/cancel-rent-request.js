const RentSearch = require('../../../models/RentSearch')
const RentRequest = require('../../../models/RentRequest')
const passengerTasks = require('../../../jobs/passenger')
const REQUEST_STATUS = require('../../../constants/trip-request-statuses')
const { ObjectId } = require('mongoose').Types
const { emitToDriver } = require('../../utils/driver')

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

    const activeRentSearch = await RentSearch.findOne({
      active: true,
      passenger: ObjectId(passenger._id)
    })

    if (!activeRentSearch) {
      socket.emit('requestCanceled')
      socket.emit('error', {
        type: 'request',
        message: 'you are not actively searching for drivers'
      })
      return
    }

    activeRentSearch.active = false
    activeRentSearch.status = REQUEST_STATUS.CANCELLED
    await activeRentSearch.save()

    const rentRequests = await RentRequest.find({
      status: REQUEST_STATUS.IN_REQUEST,
      rentSearchId: activeRentSearch._id
    })

    await passengerTasks.stopSearchingForRents(activeRentSearch)

    for (let activeRequest of rentRequests) {
      await emitToDriver(activeRequest.driver)('requestCanceled')
    }

    if (activeRentSearch.dispatcher) {
      emitToDispatcher(activeRentSearch.dispatcher)('rentSearch', activeRentSearch)
      emitToDispatcher(activeRentSearch.dispatcher)('rentRequests', await RentRequest.find({
        rentSearchId: activeRentSearch._id
      }).populate('passenger', 'firstName lastName').populate('driver', 'firstName lastName'))
    }

    return socket.emit('requestCanceled')
  } catch (error) {
    console.log(error)
  }
}
