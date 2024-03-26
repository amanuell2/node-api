const Setting = require('../../../models/Setting')
const RentSearch = require('../../../models/RentSearch')
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
    if (data && data.rentSearchId) {
        const rentSearch = await RentSearch.findOne({
            status: { $ne: TRIP_SEARCH_STATUSES.IN_PROGRESS },
            _id: ObjectId(data.rentSearchId)
          })
      
          if (rentSearch) {
            // TODO: move those actions to stopSearchingForRides
            rentSearch.status = TRIP_SEARCH_STATUSES.IN_PROGRESS
            rentSearch.active = true
            // rentSearch.requestedVehicles = []
            rentSearch.searchRound += 1
            socket.emit('rentSearch', rentSearch)
            await rentSearch.save()
      
            const setting = await Setting.findOne()
            await passengerTasks.startSearchingForRents(
              rentSearch,
              `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`
            )
            
      
            // socket.emit('searching')
          } else {
            socket.emit('err', "rentsearch not found or is non retryable")
          }
    } else {
        console.log('Invalid Data!')
    }
     
}