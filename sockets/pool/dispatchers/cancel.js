const Setting = require('../../../models/Setting')
const TripSearch = require('../../../models/TripSearch')
const TripRequest = require('../../../models/TripRequest')
const Passenger = require('../../../models/User')
const passengerTasks = require('../../../jobs/passenger')

const { makeRequest } = require('../../../services/axios')
const { default: Axios } = require('axios')
const { updateDispatcher, emitToDispatcher } = require('../../utils/dispatcher')
const { updateVehicle } = require('../../utils/vehicle')
const { notifyDriver, emitToDriver } = require('../../utils/driver')
const { notifyPassenger, emitToPassenger } = require('../../utils/passenger')
const { getActiveRequestsByDispatcher } = require('../../utils/trip-request')

const TRIP_SEARCH_STATUSES = require('../../../constants/trip-search-statuses')
const { ObjectId } = require('mongoose').Types

// const { searchForDispatcher } = require('../../core')

module.exports = async (data, dispatcher, socket) => {
    console.log(">>", data)
    if (data && data.tripSearchId) {
        const tripSearch = await TripSearch.findOne({
            active: true,
            _id: ObjectId(data.tripSearchId)
        })

        if (tripSearch) {
            // TODO: move those actions to stopSearchingForRides
            tripSearch.status = TRIP_SEARCH_STATUSES.CANCELLED
            tripSearch.cancelledBy = 'Dispatcher'
            // tripSearch.cancelledReason = req.body.reason ? req.body.reason : ''
            tripSearch.active = false
            if (dispatcher && dispatcher._id)
                tripSearch.dispatcherWhoCancelled = dispatcher._id
            await tripSearch.save()

            socket.emit('tripSearch', tripSearch)

            const activeRequests = await TripRequest.find({
                active: true,
                tripSearchId: tripSearch._id
            })

            await passengerTasks.stopSearchingForRides(tripSearch)

            for (const activeRequest of activeRequests) {

                activeRequest.cancelledBy = 'Dispatcher'
                // activeRequest.cancelledReason = req.body.reason ? req.body.reason : ''
                activeRequest.active = false
                if (dispatcher && dispatcher._id)
                    activeRequest.dispatcherWhoCancelled = dispatcher._id
                await activeRequest.save()

                await updateVehicle(activeRequest.vehicle)({ online: true,
                    // tripRequestId: null
                })

                await emitToDriver(activeRequest.driver)('requestCanceled')
                await notifyDriver(activeRequest.driver)({ title: 'Request Canceled', body: 'Request has been cancelled' })
            }
            await emitToPassenger(tripSearch.passenger)('requestCanceled')
            await notifyPassenger(tripSearch.passenger)({ title: 'Request Canceled', body: 'Request has been cancelled' })

            const activeRequestsDispatched = await getActiveRequestsByDispatcher(dispatcher._id)
            socket.emit('requests', activeRequestsDispatched)


            // socket.emit('searching')

        } else {
            socket.emit('err', "tripsearch not found or is non retryable")
        }
    } else {
        console.log('Invalid Data!')
    }

}