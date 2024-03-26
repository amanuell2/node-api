const RentSearch = require('../../models/RentSearch')

// refactored rent container code
const getRentSearch = async (rentSearchId) => {
  return await RentSearch.findById(rentSearchId)
}

const updateRentSearch = (rentSearchId) => async (changes) => {
  try {
    return await RentSearch.findByIdAndUpdate(rentSearchId, changes)
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
    getRentSearch,
    updateRentSearch
}
