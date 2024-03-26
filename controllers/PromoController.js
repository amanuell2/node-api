const Promo = require('../models/Promo');
const Setting = require('../models/Setting');
const Passenger = require('../models/User');
const logger = require('../services/logger');
const Token = require('../models/Token');

const { generateAndSendReport } = require('../utils/reports');
const { filterByTimeRange } = require('../utils/date-filter');
const Driver = require('../models/Driver');
const { ObjectId } = require('mongoose').Types

const index = (req, res) => {
    try {
        var page = 1;
        var skip = 0;
        var limit = 20;
        var nextPage;
        var prevPage;
        var filter = {};

        if (req.query.status && req.query.status != null && req.query.status != 'all') {
            filter['status'] = {
                $regex: req.query.status, $options: "i"
            };
        }

        if (req.query.from || req.query.to)
            filter['createdAt'] = filterByTimeRange(req.query.from, req.query.to)

        var activityLogs = Promo.find(filter).populate('driver').populate('passenger');
        if (req.query.page && parseInt(req.query.page) != 0) {
            page = parseInt(req.query.page);
        }
        if (req.query.limit) {
            limit = parseInt(req.query.limit);
        }

        if (page > 1) {
            prevPage = page - 1;
        }

        skip = (page - 1) * limit;

        activityLogs.sort({ createdAt: 'desc' });
        activityLogs.limit(limit);
        activityLogs.skip(skip);

        Promise.all([
            Promo.countDocuments(filter),
            activityLogs.exec()
        ]).then((value) => {
            if (value) {
                if (((page * limit) <= value[0])) {
                    nextPage = page + 1;
                }
                res.send({ data: value[1], count: value[0], nextPage, prevPage });
            }
        }).catch((error) => {
            logger.error("Promo History => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Promo History => " + error.toString());
        res.status(500).send(error);
    };
};

// const enterPromo = async (req, res) => {
//     try {
//         const authHeader = req.headers.authorization

//         if (authHeader) {
//             const [scheme, tokenSection] = authHeader.split(' ')

//             if (scheme === 'Bearer' && tokenSection) {
//                 const accessToken = tokenSection

//                 const token = await Token.findById(accessToken).populate('passenger').populate('driver')
//                 if (token && token.active && (token.passenger || token.driver)) {
//                     const promoToAccept = await Promo.findOne({
//                         inviteePhoneNumber: token.passenger.phoneNumber,
//                         code: req.body.code,
//                         type: { $or: token.passenger ? ['both', 'passenger'] : token.driver ? ['both', 'driver'] : [] },
//                         status: "INVITED"
//                     })

//                     if (promoToAccept) {
//                         promoToAccept.status = "ACTIVE"

//                         await promoToAccept.save()
//                         return res.status(200).send("invitation accepted successfully")
//                     } else {
//                         return res.status(400).send("code invalid or invitation not found")
//                     }
//                     // TODO: check for the limit here
//                     await Promo.create({
//                         passenger: token.passenger ? token.passenger._id : null,
//                         driver: token.driver ? token.driver._id : null,
//                         inviteePhoneNumber: req.body.phoneNumber,
//                     })
//                 } else {
//                     return res.status(401).send('Unauthorized')
//                 }
//             } else {
//                 return res.status(401).send('Unauthorized')
//             }
//         } else {
//             return res.status(401).send('Unauthorized')
//         }

//     } catch (error) {
//         logger.error('Promo Code Enter => ' + error.toString())
//         res.status(500).send(error)
//     }
// }

const invite = async (req, res) => {
    try {
        const authHeader = req.headers.authorization
        const setting = await Setting.findOne()

        if (authHeader) {
            const [scheme, tokenSection] = authHeader.split(' ')

            if (scheme === 'Bearer' && tokenSection) {
                const accessToken = tokenSection

                const token = await Token.findById(accessToken).populate('passenger').populate('driver')
                if (token && token.active) {

                    if (req.body.phoneNumber && req.body.type) {

                        if (!["both", "driver", "passenger"].includes(req.body.type)) {
                            return res.status(422).send("invalid promo type. please try again.")
                        }

                        if (!req.body.phoneNumber.startsWith('+251') || req.body.phoneNumber.length != 13 || isNaN(req.body.phoneNumber)) {
                            return res.status(400).send('invalid phone number (must start with +251)')
                        }

                        if ((token.passenger ? token.passenger : token.driver).phoneNumber === req.body.phoneNumber) {
                            return res.status(400).send('you can not invite yourself')
                        }

                        if (['both', 'driver'].includes(req.body.type.toLowerCase())) {
                            if (await Driver.countDocuments({
                                phoneNumber: req.body.phoneNumber
                            }))
                                return res.status(400).send('the driver you are trying to invite already exists')
                        }

                        if (['both', 'passenger'].includes(req.body.type.toLowerCase())) {
                            if (await Passenger.countDocuments({
                                phoneNumber: req.body.phoneNumber
                            }))
                                return res.status(400).send('the passenger you are trying to invite already exists')
                        }

                        const today = new Date()
                        const tmrw = new Date()
                        tmrw.setDate(tmrw.getDate() + 1)

                        today.setHours(0, 0, 0)
                        tmrw.setHours(0, 0, 0)

                        if (await Promo.countDocuments({
                            passenger: token.passenger ? ObjectId(token.passenger._id) : null,
                            driver: token.driver ? ObjectId(token.driver._id) : null,
                            inviteePhoneNumber: req.body.phoneNumber,
                            type: {
                                $in: ['both', req.body.type]
                            }
                        })) {
                            return res.status(409).send("you have already invited that person")
                        }

                        const invitedToday = await Promo.countDocuments({
                            passenger: token.passenger ? ObjectId(token.passenger._id) : null,
                            driver: token.driver ? ObjectId(token.driver._id) : null,
                            createdAt: {
                                $gte: today,
                                $lt: tmrw,
                            }
                        })

                        if (invitedToday > setting.promoInvitationDailyQuota) {
                            return res.status(409).send("you have exceeded your daily limit for invitation. please try again tomorrow.")
                        }

                        if (req.body.type === 'both') {
                            await Promo.create({
                                passenger: token.passenger ? token.passenger._id : null,
                                driver: token.driver ? token.driver._id : null,
                                inviteePhoneNumber: req.body.phoneNumber,
                                type: "driver"
                            })
                            await Promo.create({
                                passenger: token.passenger ? token.passenger._id : null,
                                driver: token.driver ? token.driver._id : null,
                                inviteePhoneNumber: req.body.phoneNumber,
                                type: "passenger"
                            })
                        } else {
                            await Promo.create({
                                passenger: token.passenger ? token.passenger._id : null,
                                driver: token.driver ? token.driver._id : null,
                                inviteePhoneNumber: req.body.phoneNumber,
                                type: req.body.type
                            })
                        }

                        res.status(200).json({
                            success: true
                        })
                    } else {
                        res.status(409).send('phoneNumber and type are required')
                    }
                } else {
                    return res.status(401).send('Unauthorized')
                }
            } else {
                return res.status(401).send('Unauthorized')
            }
        } else {
            return res.status(401).send('Unauthorized')
        }

    } catch (error) {
        logger.error('Invitation Promo => ' + error.toString())
        res.status(500).send(error)
    }
}

const myInvitations = async (req, res) => {
    try {
        const authHeader = req.headers.authorization

        if (authHeader) {
            const [scheme, tokenSection] = authHeader.split(' ')

            if (scheme === 'Bearer' && tokenSection) {
                const accessToken = tokenSection

                const token = await Token.findById(accessToken).populate('passenger').populate('driver')
                if (token && token.active) {
                    const promos = await Promo.find({
                        passenger: token.passenger ? token.passenger._id : null,
                        driver: token.driver ? token.driver._id : null,
                    }).limit(req.query.limit ? Number(req.query.limit) : 20)

                    res.status(200).send(promos)
                } else {
                    return res.status(401).send('Unauthorized')
                }
            } else {
                return res.status(401).send('Unauthorized')
            }
        } else {
            return res.status(401).send('Unauthorized')
        }
    } catch (err) {
        logger.error('my rewards => ' + err.toString())
        res.status(500).send('internal error')
    }
}

const exportReport = (req, res) => {
    try {
        var filter = {};

        if (req.query.status != null && req.query.status != 'all') {
            filter['status'] = {
                $regex: req.query.status, $options: "i"
            };
        }

        if (req.query.driver != null && req.query.driver != 'all') {
            filter['driver'] = req.query.driver;
        }

        if (req.query.passenger != null && req.query.passenger != 'all') {
            filter['passenger'] = req.query.passenger;
        }

        if (req.query.dispatcher != null && req.query.dispatcher != 'all') {
            filter['dispatcher'] = req.query.dispatcher;
        }

        console.log(req.query.passenger)
        filter['pickupTimestamp'] = filterByTimeRange(req.query.start, req.query.end)

        var trip = Promo.find(filter);

        trip.populate()
        trip.sort({ pickupTimestamp: 'desc' });

        ["driver", "passenger", "vehicleType", "dispatcher"].forEach(model => trip.populate(model))

        trip.exec().then((tripRecords) => {
            const reportData = [
                [
                    "Dispatcher",
                    "Scheduled",
                    "Passenger Name",
                    "Driver Name",
                    "Pickup / End Time",
                    "Pick / Drop Address",
                    "Type",
                    "Vehicle Type",
                    "Status",
                ].join("\t"),
                ...tripRecords.map(({
                    dispatcher,
                    schedule,
                    passenger,
                    driver,
                    pickupTimestamp,
                    endTimestamp,
                    pickUpAddress,
                    dropOffAddress,
                    vehicleType,
                    type,
                    status,
                }) => [
                    dispatcher ? dispatcher.firstName +
                        " " +
                        dispatcher.lastName
                        : " - ",
                    schedule ? "Scheduled" : "Now",
                    passenger ? passenger.firstName + " " + passenger.lastName
                        : "Unknown",

                    driver
                        ? driver.fullName
                        : "Unknown",

                    [
                        pickupTimestamp
                            ? pickupTimestamp
                            : "Canceled trip",

                        endTimestamp
                            ? endTimestamp
                            : "Canceled trip",
                    ].join(' -> '),

                    [
                        pickUpAddress.name,
                        dropOffAddress.name
                    ].join(' -> '),

                    type,

                    vehicleType ? vehicleType.name : "-",

                    status,

                ].join('\t'))
            ].join('\n')

            generateAndSendReport({
                req,
                res,
                fileName: 'generated-report-trips.xls',
                fileData: reportData
            })

        }).catch((error) => {
            logger.error("Promo History Export => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Promo History Export => " + error.toString());
        res.status(500).send(error);
    };
};

module.exports = { index, exportReport, invite, myInvitations };