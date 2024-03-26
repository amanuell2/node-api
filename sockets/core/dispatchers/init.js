const { updateDispatcher } = require('../../utils/dispatcher')
const { getActiveRequestsByDispatcher } = require('../../utils/trip-request')
const { getActiveRentRequestByDispatcher } = require('../../utils/rent-request')
const { getActiveTripSearchByDispatcher } = require('../../utils/ride-search')

module.exports = async (data, dispatcher, socket) => {
    await updateDispatcher(dispatcher._id)({ socketId: socket.id })

    if (dispatcher.tripSearchId && dispatcher.tripSearchId === "SINGLE_DRIVER") {
        socket.emit("tripSearch", {status: "SINGLE_DRIVER"})
        socket.emit('requests', await getActiveRequestsByDispatcher(dispatcher._id))
    }
    else if (dispatcher.tripSearchId && dispatcher.tripSearchId === "SINGLE_DRIVER_RENT") {
        socket.emit("rentSearch", {status: "SINGLE_DRIVER"})
        socket.emit('rentRequests', await getActiveRentRequestByDispatcher(dispatcher._id))
    }
    else if (dispatcher.tripSearchId) {
        const activeTripSearch = await getActiveTripSearchByDispatcher(dispatcher.tripSearchId)
        socket.emit('tripSearch', activeTripSearch)
        socket.emit('requests', await getActiveRequestsByDispatcher(dispatcher._id))
    } else {
        socket.emit('tripSearch')
    }
    
}