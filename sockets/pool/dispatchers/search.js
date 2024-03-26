const Setting = require('../../../models/Setting')
const TripSearch = require('../../../models/TripSearch')
const Trip = require('../../../models/Ride')
const Ticket = require('../../../models/Ticket')
const Passenger = require('../../../models/User')
const passengerTasks = require('../../../jobs/passenger')

const { makeRequest } = require('../../../services/axios')
const { default: Axios } = require('axios')
const { updateDispatcher, emitToDispatcher } = require('../../utils/dispatcher')
const { getActiveRequestsByDispatcher } = require('../../utils/trip-request')
const Driver = require('../../../models/Driver')
const Vehicle = require('../../../models/Vehicle')
const TripRequest = require('../../../models/TripRequest')
const { updateVehicle } = require('../../utils/vehicle')
const { notifyDriver, emitToDriver } = require('../../utils/driver')
const { emitToPassenger, getPassenger } = require('../../utils/passenger')
const vehicleType = require('../../../models/VehicleType')

const REQUEST_STATUS = require('../../../constants/trip-request-statuses')
// const { searchForDispatcher } = require('../../core')

module.exports = async (data, dispatcher, socket) => {
  if (data && data.pickUpAddress && data.dropOffAddress && data.vehicleType && data.phone) {
    if (data.vehicle && data.driver) {
      data.singleDriver = true
    } else {
      data.singleDriver = false
    }
    data.dispatcherId = dispatcher._id
    // searchForDispatcher(socket, data)

    // console.log(data)
    const setting = await Setting.findOne()
    let type = 'normal'
    if (data.type && data.type != undefined) {
      type = data.type
    }
    // const requestedDrivers = []
    // const removedDrivers = []

    // let driverFound = false
    // let canceled = false // TODO: canceled should be store in database
    // let corporate = false
    let schedule = null

    let ticket = null;

    if (data.ticket) {
      ticket = await Ticket.findById(data.ticket);
      if (ticket)
        corporate = ticket.corporate
    }

    if (type == 'bid' && setting.bidDriversPerRequest && setting.bidDriversPerRequest > 1) {
      requestCount = setting.bidDriversPerRequest
    }

    if (data.schedule && data.schedule != undefined) {
      schedule = new Date(data.schedule)
    }

    if (data.ticket && data.ticket != undefined) corporate = true

    const pua = {
      lat: 0,
      long: 0,
      name: ''
    }

    const doa = {
      lat: 0,
      long: 0,
      name: ''
    }

    let route

    let passengerId

    if (data.passengerId) {
      passengerId = data.passengerId
      if (data.passenger) {
        passenger = data.passenger
      } else {
        passenger = await Passenger.findById(data.passengerId)
      }
    } else {
      passenger = await Passenger.findOne({ phoneNumber: data.phone })
      if (passenger) {
        passengerId = passenger._id
      } else {
        const newPassenger = await Passenger.create({ phoneNumber: data.phone, firstName: data.name ? data.name : '_', lastName: '_' })
        if (newPassenger) {
          passenger = newPassenger
          passengerId = newPassenger._id
        }
      }
    }

    // if (await TripSearch.findOne({
    //   active: true,
    //   passenger: ObjectId(passengerId)
    // })) {
    //   console.log("passenger already searching for drivers in app")
    // }

    // if (await Trip.findOne({
    //   active: true,
    //   passenger: ObjectId(passengerId)
    // })) {
    //   console.log("passenger already in an active trip")
    // }

   

    if (data.route && data.pickUpAddress.name && data.dropOffAddress.name && data.pickUpAddress.coordinate && data.dropOffAddress.coordinate) {
      route = data.route
      doa.name = data.dropOffAddress.name
      doa.lat = data.dropOffAddress.coordinate.lat
      doa.long = data.dropOffAddress.coordinate.long
      pua.name = data.pickUpAddress.name
      pua.lat = data.pickUpAddress.coordinate.lat
      pua.long = data.pickUpAddress.coordinate.long

      if (data.vehicle) {
        const vhcl = await Vehicle.findById(data.vehicle).populate('driver').populate('vehicleType')
        if (vhcl.online) {
          const request = await TripRequest.create({
            active: true,
            driver: vhcl.driver._id,

            passenger: passenger._id,
            requestedVehicles: [],
            pickUpAddress: pua,
            dropOffAddress: doa,
            vehicleType: data.vehicleType,
            route: route,

            createdBy: 'dispatcher',
            dispatcher: dispatcher._id,

            vehicle: vhcl._id,

            ticket,
            note: data.note ? data.note : '',
            corporate: null, // TODO: add corporate
            schedule: schedule,
            bidAmount: data.bidAmount && type == "bid" ? data.bidAmount : null,
            type: type,

            targetedDispatch: true,

            status: REQUEST_STATUS.IN_REQUEST,

            tripSearchId: null,
            searchRound: 1,
            position: {
              lat: vhcl.position.coordinates[1],
              long: vhcl.position.coordinates[0],
            }
          })



          await emitToPassenger(request.passenger)('request', request)


          request.passenger = await getPassenger(request.passenger) // requester passenger's profile pic and rating are required

          // TODO: uncomment the following line after refactoring...
          // await emitToDriver(vehicleToRequest.driver)('request', request)

          // TODO: comment out the following section after refactoring...

          if (request.dispatcher) {
            socket.emit("tripSearch", {status: "SINGLE_DRIVER"})
            const activeRequestsDispatched = await getActiveRequestsByDispatcher(request.dispatcher)
            emitToDispatcher(request.dispatcher)('requests', activeRequestsDispatched)
          }
          const vehicleTypeOfTheDriver = vhcl.vehicleType
          console.log({
            ...request._doc,
            vehicleType: {
              pricePerKM: vehicleTypeOfTheDriver.pricePerKM,
              pricePerMin: vehicleTypeOfTheDriver.pricePerMin,
              surgePrice: vehicleTypeOfTheDriver.surgePrice,
              baseFare: vehicleTypeOfTheDriver.baseFare,
            }
          })
          await emitToDriver(vhcl.driver._id)('request', {
            ...request._doc,
            vehicleType: {
              pricePerKM: vehicleTypeOfTheDriver.pricePerKM,
              pricePerMin: vehicleTypeOfTheDriver.pricePerMin,
              surgePrice: vehicleTypeOfTheDriver.surgePrice,
              baseFare: vehicleTypeOfTheDriver.baseFare,
              surgePricePerKM: vehicleTypeOfTheDriver.surgePricePerKM,
              surgePricePerMin: vehicleTypeOfTheDriver.surgePricePerMin,
              surgeBaseFare: vehicleTypeOfTheDriver.surgeBaseFare,
            }
          })

          await passengerTasks.expireTripRequest(
            request._doc,
            `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`
          )

          console.log("TARGETED MANAUAL DISPATCH")
          await notifyDriver(vhcl.driver._id)({ title: 'Request', body: 'You have a new trip request' })


          await updateVehicle(vhcl._id)({
            online: false, lastTripTimestamp: new Date(),
            //  tripRequestId: request._id
          })

        }
        await updateDispatcher(dispatcher._id)({ tripSearchId: null })
        socket.emit('searching')
      } else {

      const tripSearch = await TripSearch.create({
        active: true,
        passenger: passenger._id,
        requestedVehicles: [],
        pickUpAddress: pua,
        dropOffAddress: doa,
        vehicleType: data.vehicleType,
        route: route,
        ticket,
        note: data.note ? data.note : '',
        corporate: null, // TODO: add corporate
        schedule: schedule,
        bidAmount: data.bidAmount && type == "bid" ? data.bidAmount : null,
        type: type,
        createdBy: 'dispatcher',
        dispatcher: dispatcher._id,
      })

      await updateDispatcher(dispatcher._id)({ tripSearchId: tripSearch._id })

      socket.emit('searching')

      await passengerTasks.startSearchingForRides(
        tripSearch,
        `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`
      )
      }
    } else if (data.pickUpAddress && data.pickUpAddress.place_id && data.pickUpAddress.name && data.dropOffAddress && data.dropOffAddress.name && data.dropOffAddress.place_id) {
      const pickup = Axios.get('https://maps.googleapis.com/maps/api/geocode/json?place_id=' + data.pickUpAddress.place_id + '&key=' + setting.mapKey)

      const dropOff = Axios.get('https://maps.googleapis.com/maps/api/geocode/json?place_id=' + data.dropOffAddress.place_id + '&key=' + setting.mapKey)

      Promise.all([pickup, dropOff]).then(value => {
        if (value[0].status == 200 && value[0].data.status == 'OK') {
          pua.name = data.pickUpAddress.name
          pua.lat = value[0].data.results[0].geometry.location.lat
          pua.long = value[0].data.results[0].geometry.location.lng
        } else {
          pua.name = '_'
        }

        if (value[1].status == 200 && value[1].data.status == 'OK') {
          doa.name = data.dropOffAddress.name
          doa.lat = value[1].data.results[0].geometry.location.lat
          doa.long = value[1].data.results[0].geometry.location.lng
        } else {
          doa.name = '_'
        }

        makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${pua.lat},${pua.long}&destination=${doa.lat},${doa.long}&key=${setting.mapKey}` })
        .then(async (googleMapsRouteRes) => {
          if (googleMapsRouteRes.data.status == "OK") {
            const polyline = googleMapsRouteRes.data.routes[0].overview_polyline.points;
            const distance = (googleMapsRouteRes.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.distance.value,0)
            const duration = (googleMapsRouteRes.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.duration.value,0)
            route = {
              distance,
              duration,
              polyline,
            }

            if (data.vehicle) {
              const vhcl = await Vehicle.findById(data.vehicle).populate('driver').populate('vehicleType')
              if (vhcl.online) {
                const request = await TripRequest.create({
                  active: true,
                  driver: vhcl.driver._id,
      
                  passenger: passenger._id,
                  requestedVehicles: [],
                  pickUpAddress: pua,
                  dropOffAddress: doa,
                  vehicleType: data.vehicleType,
                  route: route,
      
                  createdBy: 'dispatcher',
                  dispatcher: dispatcher._id,
      
                  vehicle: vhcl._id,
      
                  ticket,
                  note: data.note ? data.note : '',
                  corporate: null, // TODO: add corporate
                  schedule: schedule,
                  bidAmount: data.bidAmount && type == "bid" ? data.bidAmount : null,
                  type: type,
      
      
      
                  status: REQUEST_STATUS.IN_REQUEST,
      
                  tripSearchId: null,
                  searchRound: 1,
                  position: {
                    lat: vhcl.position.coordinates[1],
                    long: vhcl.position.coordinates[0],
                  }
                })
      
                await updateDispatcher(dispatcher._id)({ tripSearchId: "SINGLE_DRIVER" })
      
      
                await emitToPassenger(request.passenger)('request', request)
      
      
                request.passenger = await getPassenger(request.passenger) // requester passenger's profile pic and rating are required
      
                // TODO: uncomment the following line after refactoring...
                // await emitToDriver(vehicleToRequest.driver)('request', request)
      
                // TODO: comment out the following section after refactoring...
      
                if (request.dispatcher) {
                  socket.emit("tripSearch", {status: "SINGLE_DRIVER"})

                  const activeRequestsDispatched = await getActiveRequestsByDispatcher(request.dispatcher)
                  socket.emit('requests', activeRequestsDispatched)
                }
                const vehicleTypeOfTheDriver = vhcl.vehicleType
                console.log({
                  ...request._doc,
                  vehicleType: {
                    pricePerKM: vehicleTypeOfTheDriver.pricePerKM,
                    pricePerMin: vehicleTypeOfTheDriver.pricePerMin,
                    surgePrice: vehicleTypeOfTheDriver.surgePrice,
                    baseFare: vehicleTypeOfTheDriver.baseFare,
                  }
                })
                await emitToDriver(vhcl.driver._id)('request', {
                  ...request._doc,
                  vehicleType: {
                    pricePerKM: vehicleTypeOfTheDriver.pricePerKM,
                    pricePerMin: vehicleTypeOfTheDriver.pricePerMin,
                    surgePrice: vehicleTypeOfTheDriver.surgePrice,
                    baseFare: vehicleTypeOfTheDriver.baseFare,
                    surgePricePerKM: vehicleTypeOfTheDriver.surgePricePerKM,
                    surgePricePerMin: vehicleTypeOfTheDriver.surgePricePerMin,
                    surgeBaseFare: vehicleTypeOfTheDriver.surgeBaseFare,
                  }
                })
      
                await passengerTasks.expireTripRequest(
                  request._doc,
                  `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`
                )

                console.log("TARGETED MANAUAL DISPATCH")
                await notifyDriver(vhcl.driver._id)({ title: 'Request', body: 'You have a new trip request' })
      
      
                await updateVehicle(vhcl._id)({
                  online: false, lastTripTimestamp: new Date(),
                  //  tripRequestId: request._id
                })
      
              }
              socket.emit('searching')
            } else {

            const tripSearch = await TripSearch.create({
              active: true,
              passenger: passenger._id,
              requestedVehicles: [],
              pickUpAddress: pua,
              dropOffAddress: doa,
              vehicleType: data.vehicleType,
              route: route,
              ticket,
              note: data.note ? data.note : '',
              corporate: null, // TODO: add corporate
              schedule: schedule,
              bidAmount: data.bidAmount && type == "bid" ? data.bidAmount : null,
              type: type,
              createdBy: 'dispatcher',
              dispatcher: dispatcher._id,
            })

            await updateDispatcher(dispatcher._id)({ tripSearchId: tripSearch._id })

            socket.emit('searching', { tripSearchId: tripSearch._id })
            socket.emit('tripSearch', tripSearch)

            await passengerTasks.startSearchingForRides(
              tripSearch,
              `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`
            )
            }

          }
        }).catch((error) => {
          console.log({ error })
        })
      }).catch((error) => {
        console.log({ error })
      })
    } else if (data.pickUpAddress.coordinate && data.dropOffAddress && data.dropOffAddress.name && data.dropOffAddress.place_id) {


      pua.name = data.pickUpAddress.name ? data.pickUpAddress.name : "-"
      pua.lat = data.pickUpAddress.coordinate.lat
      pua.long = data.pickUpAddress.coordinate.long

      const dropOff = Axios.get('https://maps.googleapis.com/maps/api/geocode/json?place_id=' + data.dropOffAddress.place_id + '&key=' + setting.mapKey)

      Promise.all([dropOff]).then(value => {

        if (value[0].status == 200 && value[0].data.status == 'OK') {
          doa.name = data.dropOffAddress.name
          doa.lat = value[0].data.results[0].geometry.location.lat
          doa.long = value[0].data.results[0].geometry.location.lng
        } else {
          doa.name = '_'
        }

        makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${pua.lat},${pua.long}&destination=${doa.lat},${doa.long}&key=${setting.mapKey}` })
        .then((googleMapsRouteRes) => {      
          if (googleMapsRouteRes.data.status == "OK") {
            const polyline = googleMapsRouteRes.data.routes[0].overview_polyline.points;
            const distance = (googleMapsRouteRes.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.distance.value,0)
            const duration = (googleMapsRouteRes.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.duration.value,0)
            route = {
              distance,
              duration,
              polyline,
            }

            const tripSearch = await TripSearch.create({
              active: true,
              passenger: passenger._id,
              requestedVehicles: [],
              pickUpAddress: pua,
              dropOffAddress: doa,
              vehicleType: data.vehicleType,
              route: route,
              ticket,
              note: data.note ? data.note : '',
              corporate: null, // TODO: add corporate
              schedule: schedule,
              bidAmount: data.bidAmount && type == "bid" ? data.bidAmount : null,
              type: type,
              createdBy: 'dispatcher',
              dispatcher: dispatcher._id,
            })

            await updateDispatcher(dispatcher._id)({ tripSearchId: tripSearch._id })

            socket.emit('searching', { tripSearchId: tripSearch._id })
            socket.emit('tripSearch', tripSearch)

            await passengerTasks.startSearchingForRides(
              tripSearch,
              `${setting && setting.requestTimeout ? setting.requestTimeout : 30} seconds`
            )

          }
        }).catch((error) => {
          console.log({ error })
        })
      }).catch((error) => {
        console.log({ error })
      })
    }

    else {
      console.log('Invalid Data!')
    }



  }
}