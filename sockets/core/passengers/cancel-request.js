const TripSearch = require('../../../models/TripSearch')
const TripRequest = require('../../../models/TripRequest')
const passengerTasks = require('../../../jobs/passenger')
const REQUEST_STATUS = require('../../../constants/trip-request-statuses')
const { ObjectId } = require('mongoose').Types
const { emitToDriver } = require('../../utils/driver')
const { emitToPassenger } = require('../../utils/passenger')

module.exports = async (data, passenger, socket) => {
  try {

    if (data.tripRequestId) {


      const activeTripRequest = await TripRequest.findOne({
        active: true,
        _id: ObjectId(data.tripRequestId),
        $or: [
          {
            passenger: ObjectId(passenger._id)
          },
          {
            orderedBy: ObjectId(passenger._id)
          }
        ]
      })

      if (!activeTripRequest) {
        socket.emit('requestCanceled')
        socket.emit('error', {
          type: 'request',
          message: 'you are not actively searching for drivers'
        })
        return
      }

      activeTripRequest.active = false
      activeTripRequest.status = REQUEST_STATUS.CANCELLED
      await activeTripRequest.save()

      await emitToDriver(activeTripRequest.driver)('requestCanceled')

      emitToPassenger(activeTripRequest.passenger)('requestCanceled')

    } else if (data.tripSearchId) {

      const activeTripSearch = await TripSearch.findOne({
        active: true,
        _id: ObjectId(data.tripSearchId),
        $or: [
          {
            passenger: ObjectId(passenger._id)
          },
          {
            orderedBy: ObjectId(passenger._id)
          }
        ]
      })

      if (!activeTripSearch) {
        socket.emit('requestCanceled')
        socket.emit('error', {
          type: 'request',
          message: 'you are not actively searching for drivers'
        })
        return
      }

      activeTripSearch.active = false
      activeTripSearch.status = REQUEST_STATUS.CANCELLED
      await activeTripSearch.save()

      const tripRequests = await TripRequest.find({
        status: REQUEST_STATUS.IN_REQUEST,
        tripSearchId: activeTripSearch._id
      })

      await passengerTasks.stopSearchingForRides(activeTripSearch)

      for (let activeRequest of tripRequests) {
        //      await emitToDriver(activeRequest.driver)('requestCanceled')
        await TripRequest.updateOne({ _id: activeRequest._id }, { $set: { active: false, status: REQUEST_STATUS.CANCELLED } })
        await emitToDriver(activeRequest.driver)('requestCanceled')
      }


      emitToPassenger(activeTripSearch.passenger)('requestCanceled')
      if (activeTripSearch.orderedBy) {
        emitToPassenger(activeTripSearch.orderedBy)('requestCanceled')
      }
    } else {
      console.log("input data error on cancel-request in passenger.. tripSearchId and tripRequestId aren't present")
    }

  } catch (error) {
    console.log(error)
  }
}
