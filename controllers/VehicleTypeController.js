const VehicleType = require('../models/VehicleType')
const logger = require('../services/logger')

const index = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage

    const vehicleType = VehicleType.find()
    if (req.query.page && parseInt(req.query.page) != 0) {
      page = parseInt(req.query.page)
    }
    if (req.query.limit) {
      limit = parseInt(req.query.limit)
    }

    if (page > 1) {
      prevPage = page - 1
    }

    skip = (page - 1) * limit

    vehicleType.sort({ order: 'asc', createdAt: 'desc' })
    vehicleType.limit(limit)
    vehicleType.skip(skip)
    if (req.query.populate) {
      const populate = JSON.parse(req.query.populate)
      populate.forEach((e) => {
        vehicleType.populate(e)
      })
    }
    Promise.all([
      VehicleType.estimatedDocumentCount(),
      vehicleType.exec(),
      VehicleType.countDocuments({})
    ]).then((value) => {
      if (value) {
        if (((page * limit) <= value[0])) {
          nextPage = page + 1
        }
        res.send({ data: value[1], count: value[0], nextPage: nextPage || 1, prevPage })
      }
    }).catch((error) => {
      logger.error('Vehicle type => ' + error.toString())
      res.status(500).send(error)
    })
  } catch (error) {
    logger.error('Vehicle type => ' + error.toString())
    res.status(500).send(error)
  };
}

const show = async (req, res) => {
  try {
    const vehicleType = await VehicleType.findById(req.params.id)
    res.send(vehicleType)
  } catch (error) {
    logger.error('Vehicle type => ' + error.toString())
    res.status(500).send(error)
  };
}

const adjustOrder = async (req, res) => {
  try {
    const direction = req.body.direction
    if (!direction || ![-1, 1].includes(direction)) {
      return res.status(422).send(new Error('direction is required and should be only -1 or 1'))
    }

    const { order } = await VehicleType.findOne({ _id: req.body.id }, 'order')

    const swapWith = await VehicleType.findOne({
      order: { [direction === -1 ? '$lte' : '$gte']: order + direction }
    }, {}, { sort: { order: direction } })

    if (swapWith) {
      await VehicleType.updateOne({
        _id: swapWith._id
      }, { $set: { order: swapWith.order - direction } })

      await VehicleType.updateOne({ _id: req.body.id }, {
        $set: { order: swapWith.order }
      })
      res.json({ success: true })
    } else {
      return res.status(400).send(new Error('the operation will result in an invalid order'))
    }
  } catch (error) {
    logger.error('[Ordering Vehicle type] => ' + error.toString())
    res.status(500).send(error)
  };
}

const store = async (req, res) => {
  try {
    const savedVehicleType = await VehicleType.create(req.body)
    res.send(savedVehicleType)
  } catch (error) {
    logger.error('Vehicle type => ' + error.toString())
    res.status(500).send(error)
  }
}

const update = async (req, res) => {
  try {
    const updatedVehicleType = await VehicleType.updateOne({ _id: req.params.id }, req.body)
    res.send(updatedVehicleType)
  } catch (error) {
    logger.error('Vehicle type => ' + error.toString())
    res.status(500).send(error)
  }
}

const remove = async (req, res) => {
  try {
    const deletedVehicleType = await VehicleType.findByIdAndDelete(req.params.id)
    res.send(deletedVehicleType)
  } catch (error) {
    logger.error('Vehicle type => ' + error.toString())
    res.status(500).send(error)
  }
}

module.exports = { index, show, store, update, remove, adjustOrder }
