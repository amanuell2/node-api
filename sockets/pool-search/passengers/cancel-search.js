const PoolSearch = require('../../../models/PoolSearch')
const PoolRequest = require('../../../models/PoolRequest')
const passengerTasks = require('../../../jobs/passenger')
const REQUEST_STATUS = require('../../../constants/trip-request-statuses')
const { ObjectId } = require('mongoose').Types
const { emitToDriver } = require('../../utils/driver')

module.exports = async (data, passenger, socket) => {
  try {

    const activePoolSearch = await PoolSearch.findOne({
      active: true,
      passenger: ObjectId(passenger._id),
      _id: ObjectId(data.poolSearchId)
    })

    if (!activePoolSearch) {
      socket.emit('requestCanceled')
      socket.emit('error', {
        type: 'request',
        message: 'pool search not found'
      })
      return
    }

    if (activePoolSearch.passenger != passenger._id) {
        return socket.emit('error', {
            type: 'request',
            message: "you are not authorized to cancel the search"
        })
    }

    activePoolSearch.active = false
    activePoolSearch.status = REQUEST_STATUS.CANCELLED
    await activePoolSearch.save()

    const poolRequests = await PoolRequest.find({
      status: REQUEST_STATUS.IN_REQUEST,
      poolSearchId: activePoolSearch._id
    })

    await passengerTasks.stopSearchingForRides(activePoolSearch)

    for (let activeRequest of poolRequests) {
      //      await emitToDriver(activeRequest.driver)('requestCanceled')
      await PoolRequest.updateOne({_id: activeRequest._id}, {$set:{active: false, status: REQUEST_STATUS.CANCELLED}})
      await emitToDriver(activeRequest.driver)('requestCanceled')
    }


    return socket.emit('requestCanceled')

  } catch (error) {
    console.log(error)
  }
}