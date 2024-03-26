const Setting = require('../../../models/Setting')
const VehicleType = require('../../../models/VehicleType')
// const Request = require('../../../models/Request')
const TripRequest = require('../../../models/TripRequest')
const Vehicle = require('../../../models/Vehicle')
const Passenger = require('../../../models/User')
const Trip = require('../../../models/Ride')
const TripSearch = require('../../../models/TripSearch')
const passengerTasks = require('../../../jobs/passenger')
const TRIP_STATUS = require('../../../constants/trip-statuses')

const { makeRequest } = require('../../../services/axios')

// const { addRequest, updateRequest, getRequest } = require('../../utils/request')

// const { getNearbyDrivers } = require('../../core')

const { emitToDriver, notifyDriver } = require('../../utils/driver')
const { emitToPassenger } = require('../../utils/passenger')
const { ObjectId } = require('mongoose').Types

const { sanitizeInputs } = require('../../utils/core')
const Ticket = require('../../../models/Ticket')
const PoolSearch = require('../../../models/PoolSearch')

const schema = {
  type: "object",
  properties: {
    pickUpAddress: { type: "object" }, // TODO: make sure this includes lat and long
    dropOffAddress: { type: "object" }, // TODO: make sure this includes lat and long
    vehicleType: { type: "string" }, 
    pool: { type: "bool"},
    femaleOnlyRequired: { type: "bool" },
    stops: { type: "array" },
    orderedFor: { type: "string" },
    // type: { type: "string" },
    // schedule: { type: "string" },
    // ticket: { type: "string" },
    // bidAmount: { type: "number" },
    // note: { type: "string" },
  },
  required: ['pickUpAddress', 'dropOffAddress', 'vehicleType'],
  additionalProperties: true
}

module.exports = async (data, passenger, socket) => {

  try {

    await sanitizeInputs(schema, data)

    if (passenger.inActivePool) {
      socket.emit('error', {
        type: 'pool',
        message: 'action not allowed while in a pool'
      })
      return
    }
    
    const activeTripSearch = await TripSearch.findOne({
      active: true,
      passenger: ObjectId(passenger._id)
    })

    if (activeTripSearch) {
      console.log(activeTripSearch)
      socket.emit('error', {
        type: 'request',
        message: 'you already are requesting nearby drivers'
      })
      return
    }


    const setting = await Setting.findOne()

    var d = new Date();
    d.setMinutes(d.getMinutes() - 10);
    const filter = {
      status: TRIP_STATUS.CANCELLED,
      cancelledBy: 'Passenger',
      passenger: passenger._id,
      updatedAt: { $gte: d },
    }

    const cancelledTripsFound = await Trip.find(filter)
    if (cancelledTripsFound && cancelledTripsFound.length > 2) {
      return socket.emit('error',{
        type: 'request',
        message: 'please wait for a couple of minutes before trying again'
      })
    }

    let type = 'normal'
    if (data.type && data.type != undefined) {
      type = data.type
    }
    // const requestedDrivers = []
    // const removedDrivers = []

    // let driverFound = false
    // let canceled = false // TODO: canceled should be store in database
    let corporate = null
    let schedule = null

    let ticket = null

    if (type == 'bid' && setting.bidDriversPerRequest && setting.bidDriversPerRequest > 1) {
      requestCount = setting.bidDriversPerRequest
    }

    if (data.schedule && data.schedule != undefined) {
      schedule = new Date(data.schedule)
    }

    
    if (data.ticket) {
      ticket = await Ticket.findById(data.ticket);
      if (ticket)
        corporate = ticket.corporate
    }

    // if (data.ticket && data.ticket != undefined) corporate = true

    if (!data.pickUpAddress.name) {
      pickup = makeRequest({
        method: "get",
        url: 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + data.pickUpAddress.lat + ',' + data.pickUpAddress.long + '&key=' + setting.mapKey
      })
    } else {
      pickup = data.pickUpAddress
    }

    if (!data.dropOffAddress.name) {
      dropOff = makeRequest({
        method: "get",
        url: 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + data.dropOffAddress.lat + ',' + data.dropOffAddress.long + '&key=' + setting.mapKey
      })
    } else {
      dropOff = data.dropOffAddress
    }

    // const wayPointsString = (!data.pool && data.stops && data.stops.length) ? `&waypoints=${data.stops.map(({ lat, long }) => lat + ',' + long).join('|')}` : ''

    // console.log(wayPointsString)

    // const route = makeRequest('https://api.mapbox.com/directions/v5/mapbox/driving/' + data.pickUpAddress.long + ',' + data.pickUpAddress.lat + ';' + data.dropOffAddress.long + ',' + data.dropOffAddress.lat + '?radiuses=unlimited;&geometries=geojson&access_token=pk.eyJ1IjoiYWplYnVzaGlsaWZ0IiwiYSI6ImNsY2lyMHBjODBidzUzb210ajFpZDhoZnUifQ.0vl0bDeP9tIpf5vmo49asw')

    Promise.all([pickup, dropOff]).then(async value => {
      if (!data.pickUpAddress.name) {
        if (value[0].status == 200 && value[0].data.status == 'OK') {
          data.pickUpAddress.name = value[0].data.results[0].formatted_address
        } else {
          data.pickUpAddress.name = '_'
        }
      }

      if (!data.dropOffAddress.name) {
        if (value[1].status == 200 && value[1].data.status == 'OK') {
          data.dropOffAddress.name = value[1].data.results[0].formatted_address
        } else {
          data.dropOffAddress.name = '_'
        }
      }

      console.log("GOT HERE")
      // if (value[2] && value[2].data && value[2].data.routes && value[2].data.routes[0] && value[2].data.routes[0].geometry && value[2].data.routes[0].geometry.coordinates) {
      //   data.route = { coordinates: value[2].data.routes[0].geometry.coordinates, distance: value[2].data.routes[0].distance, duration: value[2].data.routes[0].duration }
      // }

      if (data.route && data.route.polyline) {
        console.log("using route from mobile app")   
      } else {
        const googleMapsRouteRes = await makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${data.pickUpAddress.lat},${data.pickUpAddress.long}&destination=${data.dropOffAddress.lat},${data.dropOffAddress.long}&key=${setting.mapKey}` })
        if (googleMapsRouteRes) {
          if (googleMapsRouteRes.data.status == "OK") {
              const polyline = googleMapsRouteRes.data.routes[0].overview_polyline.points;
              const distance = googleMapsRouteRes.data.routes[0].legs[0].distance.value;
              const duration = googleMapsRouteRes.data.routes[0].legs[0].duration.value;
              data.route = {
                distance,
                duration,
                polyline,
              }
          } else {
              return socket.emit('error', {
                type: "route",
                message: "google can not find the route."
              })
          }

        }
    }


      // if (googleMapsRouteRes.data.status == "OK") {
      //   const polyline = googleMapsRouteRes.data.routes[0].overview_polyline.points;
      //   const distance = (googleMapsRouteRes.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.distance.value,0)
      //   const duration = (googleMapsRouteRes.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.duration.value,0)
      //   data.route = {
      //     distance,
      //     duration,
      //     polyline,
      //   }
      // } else {
      //     return socket.emit('error', {
      //         type: "route",
      //         message: "google can not find the route."
      //     })
      // }

      console.log("data => ", JSON.stringify(data, null, 2));
      if (data.pool) {
        console.log("data.pool is true")
        const poolSearch = await PoolSearch.create({
          active: true,
          passenger: passenger._id,
          requestedVehicles: [],
          pickUpAddress: data.pickUpAddress,
          dropOffAddress: data.dropOffAddress,
          vehicleType: data.vehicleType,
          route: data.route,
          size: 2,
          femaleOnlyRequired: data.femaleOnlyRequired
        })
  
        await passengerTasks.startSearchingForPools(
          poolSearch,
          `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds` 
        )
      } else {
        let tripSearch;
        
        if (data.orderedForId) {

          let orderedFor = await Passenger.findById(data.orderedForId)

          if (!orderedFor) {
            return socket.emit('error', {
              message: "the person you're trying to order for does not exist"
            })
          }

          tripSearch = await TripSearch.create({
            active: true,
            passenger: data.orderedForId,
            requestedVehicles: [],
            orderedBy: passenger._id,
            pickUpAddress: data.pickUpAddress,
            dropOffAddress: data.dropOffAddress,
            vehicleType: data.vehicleType,
            route: data.route,
            ticket,
            note: data.note ? data.note : '',
            corporate,
            schedule: schedule,
            bidAmount: data.bidAmount && type == "bid" ? data.bidAmount : null,
            type: type,
            stops: data.stops,
            femaleOnlyRequired: data.femaleOnlyRequired,
          })  

        } else if (data.orderedFor) {
          let passengerId;

          let orderedFor = await Passenger.findOne({ phoneNumber: data.orderedFor })
          
          if (orderedFor) {
            passengerId = orderedFor._id;
          } else {
            try {
              const newPassenger = await Passenger.createWithInviteCode({ phoneNumber: data.orderedFor, firstName: data.firstName ? data.firstName : '_', lastName: data.lastName ? data.lastName : '_' })
              if (newPassenger) {
                passengerId = newPassenger._id
              }
            } catch (err) {
              console.log(err)
              return socket.emit('error', {
                message: "error creating the new passenger"
              });
            }
          }

          tripSearch = await TripSearch.create({
            active: true,
            passenger: passengerId,
            requestedVehicles: [],
            orderedBy: passenger._id,
            pickUpAddress: data.pickUpAddress,
            dropOffAddress: data.dropOffAddress,
            vehicleType: data.vehicleType,
            route: data.route,
            ticket,
            note: data.note ? data.note : '',
            corporate,
            schedule: schedule,
            bidAmount: data.bidAmount && type == "bid" ? data.bidAmount : null,
            type: type,
            stops: data.stops,
            femaleOnlyRequired: data.femaleOnlyRequired,
          })  
        } else {
          tripSearch = await TripSearch.create({
            active: true,
            passenger: passenger._id,
            requestedVehicles: [],
            orderedBy: null,
            pickUpAddress: data.pickUpAddress,
            dropOffAddress: data.dropOffAddress,
            vehicleType: data.vehicleType,
            route: data.route,
            ticket,
            note: data.note ? data.note : '',
            corporate,
            schedule: schedule,
            bidAmount: data.bidAmount && type == "bid" ? data.bidAmount : null,
            type: type,
            stops: data.stops,
            femaleOnlyRequired: data.femaleOnlyRequired,
          })
        }
        
  
        await passengerTasks.startSearchingForRides(
          tripSearch,
          `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds` 
        )
      }
    }).catch(err => console.log(err))

  } catch (error) {
    console.log(error)
  }

}