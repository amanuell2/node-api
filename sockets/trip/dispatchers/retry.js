const Setting = require('../../../models/Setting')
const TripSearch = require('../../../models/TripSearch')
const Passenger = require('../../../models/User')
const passengerTasks = require('../../../jobs/passenger')

const { makeRequest } = require('../../../services/axios')
const { default: Axios } = require('axios')
const { updateDispatcher } = require('../../utils/dispatcher')

const TRIP_SEARCH_STATUSES = require('../../../constants/trip-search-statuses')
const { ObjectId } = require('mongoose').Types

// const { searchForDispatcher } = require('../../core')

module.exports = async (data, dispatcher, socket) => {
    console.log(">>", data)
    if (data && data.tripSearchId) {
        const tripSearch = await TripSearch.findOne({
            status: { $ne: TRIP_SEARCH_STATUSES.IN_PROGRESS },
            _id: ObjectId(data.tripSearchId)
          })
      
          if (tripSearch) {
            tripSearch.status = TRIP_SEARCH_STATUSES.IN_PROGRESS
            tripSearch.active = true
            // tripSearch.requestedVehicles = []
            tripSearch.searchRound += 1
            socket.emit('tripSearch', tripSearch)
            await tripSearch.save()
      
            const setting = await Setting.findOne()
            await passengerTasks.startSearchingForRides(
              tripSearch,
              `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`
            )
            
      
            // socket.emit('searching')
          } else {
            socket.emit('err', "tripsearch not found or is non retryable")
          }
    } else {
        console.log('Invalid Data!')
    }
     
}