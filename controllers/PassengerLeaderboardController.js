const Ride = require('../models/Ride')
const { request, json } = require('express')
const { send } = require('../services/emailService')
const { sendNotification } = require('../services/notificationService')
const { sendEmail, customerEmail } = require('../services/emailService')
const logger = require('../services/logger')
const SOS = require('../models/SOS')
const Setting = require('../models/Setting')
const Ticket = require('../models/Ticket')
const { updateWallet } = require('./DriverController')
const Vehicle = require('../models/Vehicle')
const { getIO } = require('../sockets/io')
const { log } = require('../services/logger')

const { emitToPassenger, notifyPassenger } = require('../sockets/utils/passenger')
const { emitToDriver, notifyDriver } = require('../sockets/utils/driver')

const { generateAndSendReport } = require('../utils/reports')
const { filterByTimeRange } = require('../utils/date-filter')

const TRIP_STATUS = require('../constants/trip-statuses')

const index = async (req, res) => {
    try {
        let page = 1
        let skip = 0
        let limit = 20
        let nextPage
        let prevPage

        let tripType = "";

        if (req.query.type && ['roadPickup', 'normal', 'corporate', 'bid', 'pool'].includes(req.query.type)) {
            tripType = req.query.type;
        }

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

            const filterObj = {
                createdAt: filterByTimeRange(req.query.from, req.query.to),
                status: TRIP_STATUS.COMPLETED
            }

            if (tripType && tripType.length) {
                filterObj.type = tripType;
            }

            const [results, ..._] = await Ride.aggregate([
                {
                    $match: filterObj
                },
                {
                    "$project": {
                        passenger: 1,
                    }
                },
                {
                    $addFields: {
                        count: 1
                    },
                },
                {
                    "$group": {
                        "_id": "$passenger",
                        passengerId: { "$first": "$passenger" },
                        numOfTrips: {
                            "$sum": "$$ROOT.count"
                        }
                    }
                },
                { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'passenger' } },
                { $unwind: { path: '$passenger' } },
                {
                    $sort: {
                        numOfTrips: -1
                    }
                },
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
                const { count, data } = results

                // const len = await Driver.countDocuments(filter)
                if (((page * limit) <= count)) {
                    nextPage = page + 1
                }

                res.send({ data, count, nextPage, prevPage })
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

module.exports = { index }
