const Driver = require('../models/Driver')
const Vehicle = require('../models/Vehicle')
const Ride = require('../models/Ride')
const mongoose = require('mongoose')
const logger = require('../services/logger')

const { generateAndSendReport } = require('../utils/reports')

const TRIP_STATUS = require('../constants/trip-statuses')
const TRIP_TYPES = require('../constants/trip-types')
const MODELS = require('../constants/model-names')

const { ObjectId } = require('mongoose').Types

const filterByTimeRange = function (field, from, to) {
  const filter = []

  if (from) {
    from = new Date(new Date(from).toISOString().slice(0, 10))
    // f.setDate(new Date(from).getDate())
  }
  if (to) {
    to = new Date(to).toISOString().slice(0, 10)
    const nextDay = new Date(to)
    nextDay.setDate(new Date(to).getDate() + 1)
    to = nextDay
  }

  if (from && from != 'all' && to && to != 'all') {
    filter.push({
      $gte: [`$${field}`, from],
    })
    filter.push({
      $lt: [`$${field}`, to]
    })
  } else if (to && to != 'all') {
    filter.push({
      $lt: [`$${field}`, from],
    })
  } else if (from && from != 'all') {
    filter.push({
      $gte: [`$${field}`, from],
    })
  } else {
    filter.push({
      $gte: [`$${field}`, new Date(1900, 1, 1)],
    })
  }

  return filter
}


const index = async (req, res) => {
  try {
    let page = 1
    let skip = 0
    let limit = 20
    let nextPage
    let prevPage

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

    try {
      const [results, ..._] = await Driver.aggregate([
        // {
        //     $match: {
        //         createdAt: filterByTimeRange(req.query.from, req.query.to),
        //         status: TRIP_STATUS.COMPLETED
        //     }
        // },
        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)
                  ]
                },
              },
            },
            {
              $count: 'value'
            },
            ],
            as: 'totalTripsCount'
          }
        },
        { $unwind: { path: '$totalTripsCount', preserveNullAndEmptyArrays: true } },



        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    {
                      $eq: [
                        '$type', TRIP_TYPES.CORPORATE,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)
                  ]
                },
              },
            },
            {
              $count: 'value'
            },
            ],
            as: 'corporateTripsCount'
          }
        },
        { $unwind: { path: '$corporateTripsCount', preserveNullAndEmptyArrays: true } },



        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    {
                      $ne: [
                        '$type', TRIP_TYPES.CORPORATE,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)
                  ]
                },
              },
            },
            {
              $count: 'value'
            },
            ],
            as: 'regularTripsCount'
          }
        },
        { $unwind: { path: '$regularTripsCount', preserveNullAndEmptyArrays: true } },






        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)

                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$fare"
                }
              }
            },
            ],
            as: 'totalFare'
          }
        },
        { $unwind: { path: '$totalFare', preserveNullAndEmptyArrays: true } },



        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    {
                      $eq: [
                        '$type', TRIP_TYPES.CORPORATE,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)

                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$fare"
                }
              }
            },
            ],
            as: 'corporateFare'
          }
        },
        { $unwind: { path: '$corporateFare', preserveNullAndEmptyArrays: true } },


        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    {
                      $ne: [
                        '$type', TRIP_TYPES.CORPORATE,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)

                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$fare"
                }
              }
            },
            ],
            as: 'regularFare'
          }
        },
        { $unwind: { path: '$regularFare', preserveNullAndEmptyArrays: true } },







        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)

                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$totalDistance"
                }
              }
            },
            ],
            as: 'totalDistance'
          }
        },
        { $unwind: { path: '$totalDistance', preserveNullAndEmptyArrays: true } },



        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    {
                      $eq: [
                        '$type', TRIP_TYPES.CORPORATE,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)

                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$totalDistance"
                }
              }
            },
            ],
            as: 'corporateDistance'
          }
        },
        { $unwind: { path: '$corporateDistance', preserveNullAndEmptyArrays: true } },


        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    {
                      $ne: [
                        '$type', TRIP_TYPES.CORPORATE,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)

                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$totalDistance"
                }
              }
            },
            ],
            as: 'regularDistance'
          }
        },
        { $unwind: { path: '$regularDistance', preserveNullAndEmptyArrays: true } },
        
        
        
        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)

                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$companyCut"
                }
              }
            },
            ],
            as: 'commission'
          }
        },
        { $unwind: { path: '$commission', preserveNullAndEmptyArrays: true } },










        {
          $facet: {
            count: [
              {
                $count: 'value'
              }
            ],
            data: [
              {
                $skip: skip
              },
              {
                $limit: limit
              }
            ]
          }
        },
        { $project: { count: { $arrayElemAt: ['$count.value', 0] }, data: '$data' } }
      ])

      if (results) {
        console.log(results)
        const { count, data } = results

        // const len = await Driver.countDocuments(filter)
        if (((page * limit) <= count)) {
          nextPage = page + 1
        }

        res.send({ data: data, count, nextPage, prevPage })
      } else {
        res.send({
          data: [],
          count: 0
        })
      }

    } catch (error) {
      console.log(error)
      logger.error('Leaderboard => ' + error.toString())
      res.status(500).send(error)
    }
  } catch (error) {
    console.log(error)
    logger.error('Leaderboard => ' + error.toString())
    res.status(500).send(error)
  };
}

const exportReport = async (req, res) => {
  try {
   
    try {
    
      const results = await Driver.aggregate([
        // {
        //     $match: {
        //         createdAt: filterByTimeRange(req.query.from, req.query.to),
        //         status: TRIP_STATUS.COMPLETED
        //     }
        // },
        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)
                  ]
                },
              },
            },
            {
              $count: 'value'
            },
            ],
            as: 'totalTripsCount'
          }
        },
        { $unwind: { path: '$totalTripsCount', preserveNullAndEmptyArrays: true } },



        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    {
                      $eq: [
                        '$type', TRIP_TYPES.CORPORATE,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)
                  ]
                },
              },
            },
            {
              $count: 'value'
            },
            ],
            as: 'corporateTripsCount'
          }
        },
        { $unwind: { path: '$corporateTripsCount', preserveNullAndEmptyArrays: true } },



        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    {
                      $ne: [
                        '$type', TRIP_TYPES.CORPORATE,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)
                  ]
                },
              },
            },
            {
              $count: 'value'
            },
            ],
            as: 'regularTripsCount'
          }
        },
        { $unwind: { path: '$regularTripsCount', preserveNullAndEmptyArrays: true } },








        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)

                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$fare"
                }
              }
            },
            ],
            as: 'totalFare'
          }
        },
        { $unwind: { path: '$totalFare', preserveNullAndEmptyArrays: true } },



        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    {
                      $eq: [
                        '$type', TRIP_TYPES.CORPORATE,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)
                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$fare"
                }
              }
            },
            ],
            as: 'corporateFare'
          }
        },
        { $unwind: { path: '$corporateFare', preserveNullAndEmptyArrays: true } },


        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    {
                      $ne: [
                        '$type', TRIP_TYPES.CORPORATE,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)
                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$fare"
                }
              }
            },
            ],
            as: 'regularFare'
          }
        },
        { $unwind: { path: '$regularFare', preserveNullAndEmptyArrays: true } },







        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)
                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$totalDistance"
                }
              }
            },
            ],
            as: 'totalDistance'
          }
        },
        { $unwind: { path: '$totalDistance', preserveNullAndEmptyArrays: true } },



        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    {
                      $eq: [
                        '$type', TRIP_TYPES.CORPORATE,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)
                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$totalDistance"
                }
              }
            },
            ],
            as: 'corporateDistance'
          }
        },
        { $unwind: { path: '$corporateDistance', preserveNullAndEmptyArrays: true } },


        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    {
                      $ne: [
                        '$type', TRIP_TYPES.CORPORATE,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)
                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$totalDistance"
                }
              }
            },
            ],
            as: 'regularDistance'
          }
        },
        { $unwind: { path: '$regularDistance', preserveNullAndEmptyArrays: true } },
        
        
        
        {
          $lookup: {
            from: "rides",
            let: { driverId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        '$driver', '$$driverId',
                      ],
                    },
                    {
                      $eq: [
                        '$status', TRIP_STATUS.COMPLETED,
                      ]
                    },
                    ...filterByTimeRange('pickupTimestamp', req.query.from, req.query.to)
                  ]
                },
              },
            },
            {
              "$group": {
                "_id": "$driver",
                value: {
                  "$sum": "$companyCut"
                }
              }
            },
            ],
            as: 'commission'
          }
        },
        { $unwind: { path: '$commission', preserveNullAndEmptyArrays: true } },










        // {
        //   $facet: {
        //     count: [
        //       {
        //         $count: 'value'
        //       }
        //     ],
        //     data: [
        //       {
        //         $skip: skip
        //       },
        //       {
        //         $limit: limit
        //       }
        //     ]
        //   }
        // },
        // { $project: { count: { $arrayElemAt: ['$count.value', 0] }, data: '$data' } }
      ])

  console.log('exporting in progress')

      const reportData = [
        "DRIVER ID	NAME	NO OF ORDERS REGULAR	KM	AMOUNT CASH	NO OF ORDERS CORPORATE	CORPORATE KM	CORPORATE AMOUNT	TOTAL KM	TOTAL AMOUNT	COMMISSION",
        ...results.map(({
          driverId,
          firstName,
          lastName,
          totalTripsCount,
          regularTripsCount,
          corporateTripsCount,
          totalFare,
          corporateFare,
          regularFare,
          totalDistance,
          corporateDistance,
          regularDistance,
          commission
        }) => [
          driverId,
          firstName + ' ' + lastName,
          
          regularTripsCount && regularTripsCount.value ? regularTripsCount.value : '-',
          regularDistance && regularDistance.value ? regularDistance.value.toFixed(2) : '-',
          regularFare && regularFare.value ? regularFare.value.toFixed(2) : '-',
          
          corporateTripsCount && corporateTripsCount.value ? corporateTripsCount.value : '-',
          corporateDistance && corporateDistance.value ? corporateDistance.value.toFixed(2) : '-',
          corporateFare && corporateFare.value ? corporateFare.value.toFixed(2) : '-',

          // totalTripsCount && totalTripsCount.value ? totalTripsCount.value : '-',
          totalDistance && totalDistance.value ? totalDistance.value.toFixed(2) : '-',
          totalFare && totalFare.value ? totalFare.value.toFixed(2) : '-',
          
          commission && commission.value ? commission.value.toFixed(2) : '-',
        ].join('\t'))
      ].join('\n')

      generateAndSendReport({
        req,
        res,
        fileName: 'generated-report.xls',
        fileData: reportData
      })
    } catch (error) {
      logger.error('Driver => ' + error.toString())
      res.status(500).send(error)
    }
  } catch (error) {
    logger.error('Driver => ' + error.toString())
    res.status(500).send(error)
  }
}
module.exports = { index, exportReport }