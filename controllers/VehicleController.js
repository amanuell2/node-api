const Vehicle = require('../models/Vehicle')
const logger = require('../services/logger')
const mongoose = require('mongoose')
const Driver = require('../models/Driver')
const { ObjectId } = mongoose.Types 

const index = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage
    const filter = {
      $or: [
        {
          plateNumber: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          color: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          modelName: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          modelYear: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        },
        {
          'driver.fullName': {
            $regex: req.query.q ? req.query.q : '',
            $options: 'i'
          }
        }
      ]
    }

    if (req.query.vehicleType != null && req.query.vehicleType != 'all') {
      filter.vehicleType = mongoose.Types.ObjectId(req.query.vehicleType)
    }

    if (req.query.active != null && req.query.active != 'all' && ['true', 'false'].includes(req.query.active.toLowerCase())) {
      filter.active = Boolean(req.query.active.toLowerCase())
    }
    if (req.query.online != null && req.query.online != 'all' && ['true', 'false'].includes(req.query.online.toLowerCase())) {
      filter.online = req.query.online.toLowerCase() === 'true'

      if (!filter.online) {
        filter.inActiveTrip = false 
      }
    }
    if (req.query.completed != null && req.query.completed != 'all' && ['true', 'false'].includes(req.query.completed.toLowerCase())) {
      const completed = req.query.completed.toLowerCase()
      if (completed === 'true') {
        filter.completed = true
      } else {
        filter.completed = { $ne: true }
      }
    }

    // var results = Vehicle.find(filter);
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

    // vehicle.sort({createdAt: 'desc'});
    // vehicle.limit(limit);
    // vehicle.skip(skip);
    // if (req.query.populate) {
    //     var populate = JSON.parse(req.query.populate)
    //     populate.forEach((e) => {
    //         vehicle.populate(e);
    //     });
    // }
    // Promise.all([
    //     Vehicle.countDocuments(filter),
    //     vehicle.exec()
    // ]).then((value) => {
    //     if (value) {
    //         if (((page  * limit) <= value[0])) {
    //             nextPage = page + 1;
    //         }
    //         res.send({data: value[1], count: value[0], nextPage, prevPage});
    //     }
    // }).catch((error) => {
    //     logger.error("Vehicle => " + error.toString());
    //     res.status(500).send(error);
    // });
    const count = (await Vehicle.aggregate([
      {
        $lookup: {
          from: 'drivers',
          localField: 'driver',
          foreignField: '_id',
          as: 'driver'
        }
      },
      { $unwind: { path: '$driver' } },
      {
        $addFields: {
          'driver.fullName': { $concat: ['$driver.firstName', ' ', '$driver.lastName'] }
        }
      },
      {
        $match: filter
      },
      {
        $sort: {
          createdAt: -1
        }
      }
    ])).length

    const results = await Vehicle.aggregate([
      {
        $lookup: {
          from: 'drivers',
          localField: 'driver',
          foreignField: '_id',
          as: 'driver'
        }
      },
      { $unwind: { path: '$driver' } },
      {
        $addFields: {
          'driver.fullName': { $concat: ['$driver.firstName', ' ', '$driver.lastName'] }
        }
      },
      {
        $match: filter
      },
      {
        $sort: {
          createdAt: -1
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: 'vehicletypes',
          localField: 'vehicleType',
          foreignField: '_id',
          as: 'vehicleType'
        }
      },
      { $unwind: { path: '$vehicleType' } }
    ])

    if (((page * limit) <= results.length)) {
      nextPage = page + 1
    }

    res.send({ data: results, count, nextPage, prevPage })
  } catch (error) {
    logger.error('Vehicle => ' + error.toString())
    res.status(500).send(error)
  };
}

const activeVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ online: true }).populate('driver')
    res.send(vehicles)
  } catch (error) {
    logger.error('Vehicle => ' + error.toString())
    res.status(500).send(error)
  }
}

const search = (req, res) => {
  try {
    const filter = {
      $or: [
        {
          plateNumber: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          color: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          modelName: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }, {
          modelYear: {
            $regex: req.query.q ? req.query.q : '', $options: 'i'
          }
        }
      ]
    }

    if (req.query.vehicleType != null && req.query.vehicleType != 'all') {
      filter.vehicleType = req.query.vehicleType
    }

    if (req.query.online != null && req.query.online != 'all') {
      filter.online = req.query.online
    }

    if (req.query.active != null && req.query.active != 'all') {
      filter.active = req.query.active
    }

    Vehicle.find(filter, (error, vehicles) => {
      if (error) {
        logger.error('Vehicle => ' + error.toString())
        res.status(500).send(error)
      }

      if (vehicles) {
        res.send(vehicles)
      }
    }).limit(10).populate('vehicleType').populate('driver')
  } catch (error) {
    logger.error('Vehicle => ' + error.toString())
    res.status(500).send(error)
  }
}

const show = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
    res.send(vehicle)
  } catch (error) {
    logger.error('Vehicle => ' + error.toString())
    res.status(500).send(error)
  };
}

const store = async (req, res) => {
  try {
    const savedVehicle = await Vehicle.create(req.body)
    if (req.body.driver) {
      const assignedDriver = await Driver.findOne({_id: ObjectId(req.body.driver)})

      await Vehicle.updateOne({ _id: savedVehicle._id }, {$set:{isFemaleDriver: assignedDriver.isFemaleDriver}})
    }
    res.send(savedVehicle)
  } catch (error) {
    logger.error('Vehicle => ' + error.toString())
    res.status(500).send(error)
  }
}

const isTaken = async (req, res) => {
  try {
      if (req.query.plateNumber) {
          console.log("plateNumber:", req.query.plateNumber)
          res.send(await Vehicle.count({ plateNumber: req.query.plateNumber }) > 0);
      } else {
          res.status(422).send('please send the plate number')
      }
  } catch (error) {
      logger.error("Vehicle => " + error.toString());
      res.status(500).send(error);
  }
};

const update = async (req, res) => {
  try {
    const updatedVehicle = await Vehicle.updateOne({ _id: req.params.id }, req.body)

    if (req.body.driver) {
      const assignedDriver = await Driver.findOne({_id: ObjectId(req.body.driver)})

      await Vehicle.updateOne({ _id: req.params.id }, {$set:{isFemaleDriver: assignedDriver.isFemaleDriver}})
    }
    res.send(updatedVehicle)
  } catch (error) {
    logger.error('Vehicle => ' + error.toString())
    res.status(500).send(error)
  }
}

const remove = async (req, res) => {
  try {
    const deletedVehicle = await Vehicle.findByIdAndDelete(req.params.id)
    res.send(deletedVehicle)
  } catch (error) {
    logger.error('Vehicle => ' + error.toString())
    res.status(500).send(error)
  }
}

module.exports = { index, activeVehicles, show, store, update, remove, search, isTaken }