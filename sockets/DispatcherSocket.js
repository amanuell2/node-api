const { extractDispatcherFromToken } = require('./utils/dispatcher')

module.exports = async (socket) => {

  const registerSocketHandler = (moduleName) => async data => {
    const profileData = await extractDispatcherFromToken(socket)
    // console.log(`[SOCKET] bootstraping: ${moduleName} ...`)
    // console.log(profileData)
    return profileData ? require(moduleName)(data, profileData, socket) : () => { }
  }

  socket.on('init', registerSocketHandler('./core/dispatchers/init'))
  socket.on('nearbyDrivers', registerSocketHandler('./core/dispatchers/nearby-drivers'))
  socket.on('nearbyDrivers', registerSocketHandler('./core/dispatchers/nearby-drivers'))
  socket.on('estimate', registerSocketHandler('./trip/dispatchers/estimate'))
  socket.on('search', registerSocketHandler('./trip/dispatchers/search'))
  socket.on('searchCorporate', registerSocketHandler('./trip/dispatchers/searchCorporate'))
  socket.on('searchCorporateFromDispatcher', registerSocketHandler('./trip/dispatchers/searchCorporateFromDispatcher'))
  socket.on('retry', registerSocketHandler('./trip/dispatchers/retry'))
  socket.on('cancel', registerSocketHandler('./trip/dispatchers/cancel'))
  socket.on('cancelRent', registerSocketHandler('./rent/dispatchers/cancel-rent'))
  socket.on('retryRent', registerSocketHandler('./rent/dispatchers/retry'))
  socket.on('rent', registerSocketHandler('./rent/dispatchers/rent'))
  socket.on('rentCorporate', registerSocketHandler('./rent/dispatchers/rentCorporate'))
  socket.on('cancelRequest', registerSocketHandler('./request/dispatchers/cancel-request'))
  socket.on('disconnect', registerSocketHandler('./core/dispatchers/disconnect'))

}
