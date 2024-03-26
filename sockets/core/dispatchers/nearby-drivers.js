const Setting = require('../../../models/Setting')
const { makeRequest } = require('../../../services/axios')
const { getNearbyDrivers } = require('../../core')

const { getVehicleType } = require('../../utils/vehicle-type')
const { NEARBY_DRIVERS_LIMIT } = require('../../PassengerSocket')

module.exports = async (data, dispatcher, socket) => {
    const setting = await Setting.findOne()
    try {
      const vehicleTypeSelected = await getVehicleType(data.vehicleType)

      if (data && data.location && data.location.place_id) {
        const { location: { place_id } } = data
        console.log(place_id)
        makeRequest({ method: 'get', url: 'https://maps.googleapis.com/maps/api/geocode/json?place_id=' + place_id + '&key=' + setting.mapKey }).then(async value => {
          if (value.status == 200 && value.data.status == 'OK') {
            // const coordinates = {}
            // place.lat = value[0].data.results[0].geometry.location.lat;
            // place.long = value[0].data.results[0].geometry.location.lng;
            const { lat, lng } = value.data.results[0].geometry.location
            try {
              const drivers = await getNearbyDrivers({ location: { lat, long: lng }, distance: setting.searchRadius ? setting.searchRadius * 1000 : 10000, limit: NEARBY_DRIVERS_LIMIT, vehicleType: vehicleTypeSelected.isAnyType ? null : data.vehicleType })
              console.log('DRVERS', drivers)
              socket.emit('nearbyDrivers', drivers)
            } catch (error) {
              console.log(error)
            }
          } else {
            socket.emit('couldNotFetchCoordinate')
          }
        }).catch((err) => {
          console.log(err)
        })
      } else if (data && data.location && data.location.coordinate) {
        const { location: { coordinate } } = data

        const { lat, long } = coordinate
        try {
          const drivers = await getNearbyDrivers({ location: { lat, long }, distance: setting.searchRadius ? setting.searchRadius * 1000 : 10000, limit: NEARBY_DRIVERS_LIMIT, vehicleType: vehicleTypeSelected.isAnyType ? null : data.vehicleType })
          socket.emit('nearbyDrivers', drivers)
        } catch (error) {
          console.log(error)
        }
      } else {
        socket.emit('couldNotFetchCoordinate')
      }
    } catch (error) {
      console.log(error)
    }
  }