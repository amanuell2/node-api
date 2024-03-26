const Rent = require('../../models/Rent')
const { ObjectId } = require('mongoose').Types

// refactored rent container code
const getRent = async (rentId) => {
    return await Rent.findById(rentId)
}

const updateRent = ({
    passenger,
    driver
}) => async (changes) => {
    try {
        return await Rent.updateOne({
            driver: ObjectId(driver),
            passenger: ObjectId(passenger),
        }, changes)
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getRent,
    updateRent
}
