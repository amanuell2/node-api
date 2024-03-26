const Setting = require('../../../models/Setting')
const Corporate = require('../../../models/Corporate')
const VehicleType = require('../../../models/VehicleType')
const { makeRequest } = require('../../../services/axios')

module.exports = async (data, dispatcher, socket) => {
  if (data && data.pickUpAddress && data.dropOffAddress && data.vehicleType && data.dropOffAddress.name && data.pickUpAddress.name) {
    console.log("\n\n\3222222222222222222222222222222222222222")
    console.log(JSON.stringify(data, null, 2))
    console.log("\n\n\3222222222222222222222222222222222222222")
    const setting = await Setting.findOne()
    let pickup, dropOff
    if (data.pickUpAddress.place_id && !data.pickUpAddress.coordinate) {
      pickup = makeRequest({ method: 'get', url: 'https://maps.googleapis.com/maps/api/geocode/json?place_id=' + data.pickUpAddress.place_id + '&key=' + setting.mapKey })
    }
    if (data.dropOffAddress.place_id && !data.dropOffAddress.coordinate) {
      dropOff = makeRequest({ method: 'get', url: 'https://maps.googleapis.com/maps/api/geocode/json?place_id=' + data.dropOffAddress.place_id + '&key=' + setting.mapKey })
    }
    let vehicleType

    let pricing = {};

    Promise.all([pickup, dropOff, VehicleType.findById(data.vehicleType)]).then(async value => {
      const pua = {}
      const doa = {}
      
      // if (!(value[0] && value[0].status && value[1] && value[1].status)) {
      //   return
      // }
  

      if (value[0] == null && data.pickUpAddress.coordinate) {
        pua.name = data.pickUpAddress.name
        pua.lat = data.pickUpAddress.coordinate.lat
        pua.long = data.pickUpAddress.coordinate.long
      } else if (value[0].status == 200 && value[0].data.status == 'OK') {
        pua.name = data.pickUpAddress.name
        pua.lat = value[0].data.results[0].geometry.location.lat
        pua.long = value[0].data.results[0].geometry.location.lng
      } else {
        pua.name = '_'
        return
      }

      console.log(value[1])
      console.log(value[1].data)
      console.log(value[1].data.status)
      if (value[1] == null && data.dropOffAddress.coordinate) {
        doa.name = data.dropOffAddress.name
        doa.lat = data.dropOffAddress.coordinate.lat
        doa.long = data.dropOffAddress.coordinate.long
      } else if (value[1].status == 200 && value[1].data.status == 'OK') {
        doa.name = data.dropOffAddress.name
        doa.lat = value[1].data.results[0].geometry.location.lat
        doa.long = value[1].data.results[0].geometry.location.lng
      } else {
        doa.name = '_'
        return
      }

      if (value[2]) {
        vehicleType = value[2]

        if (data.selectedCorporate) {
          const corporate = await Corporate.findById(data.selectedCorporate)
  
          if (corporate.pricing) {
            vehicleType.pricePerKM = corporate.pricing.pricePerKM
            vehicleType.pricePerMin = corporate.pricing.pricePerMin
            vehicleType.baseFare = corporate.pricing.baseFare
            pricing = corporate.pricing
          }

        }
      } else {
        return
      }

      makeRequest({ method: 'get', url: `https://maps.googleapis.com/maps/api/directions/json?origin=${pua.lat},${pua.long}&destination=${doa.lat},${doa.long}&key=${setting.mapKey}` })
        .then((googleMapsRouteRes) => {      
          if (googleMapsRouteRes.data.status == "OK") {
            const polyline = googleMapsRouteRes.data.routes[0].overview_polyline.points;
            const distance = (googleMapsRouteRes.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.distance.value,0)
            const duration = (googleMapsRouteRes.data.routes[0].legs || []).reduce((prev, curr) => prev + curr.duration.value,0)
            const route = {
                distance,
                duration,
                polyline,
            }
            const estimate = {
              distance: route.distance / 1000,
              duration: route.duration / 60,
              route: route.coordinates,
              fare: ((route.distance / 1000) * vehicleType.pricePerKM) + vehicleType.baseFare, /* + ((route.duration / 60) * vehicleType.pricePerMin) */
              corporate: {}
            }
            if (data.selectedCorporate) {
              estimate.corporate.baseFare = pricing.baseFare
              estimate.corporate.estimatedFare = ((route.distance / 1000) * pricing.pricePerKM) + pricing.baseFare /* + ((route.duration / 60) * vehicleType.pricePerMin) */
            }
            socket.emit('estimate-response', estimate)
          } else {
              return socket.emit('error', {
                  type: "route",
                  message: "google can not find the route."
              })
          }
        }).catch((error) => {
          console.log({ error })
        })

      // makeRequest({ method: 'get', url: 'https://api.mapbox.com/directions/v5/mapbox/driving/' + pua.long + ',' + pua.lat + ';' + doa.long + ',' + doa.lat + '?radiuses=unlimited;&geometries=geojson&access_token=pk.eyJ1IjoiYWplYnVzaGlsaWZ0IiwiYSI6ImNsY2lyMHBjODBidzUzb210ajFpZDhoZnUifQ.0vl0bDeP9tIpf5vmo49asw' })
      //   .then((routeObject) => {
      //     if (routeObject && routeObject.data && routeObject.data.routes && routeObject.data.routes[0] && routeObject.data.routes[0].geometry && routeObject.data.routes[0].geometry.coordinates) {
      //       const route = { coordinates: routeObject.data.routes[0].geometry.coordinates, distance: routeObject.data.routes[0].distance, duration: routeObject.data.routes[0].duration }
      //       const estimate = {
      //         distance: route.distance / 1000,
      //         duration: route.duration / 60,
      //         route: route.coordinates,
      //         fare: ((route.distance / 1000) * vehicleType.pricePerKM) + vehicleType.baseFare /* + ((route.duration / 60) * vehicleType.pricePerMin) */
      //       }
      //       socket.emit('estimate-response', estimate)
      //     }
      //   }).catch((error) => {
      //     console.log({ error })
      //   })
    }).catch((error) => {
      console.log({ error })
    })
  }
}