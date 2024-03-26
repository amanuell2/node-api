const DriverBan = require('../models/DriverBan');
const Driver = require('../models/Driver');
const logger = require('../services/logger');

const { generateAndSendReport } = require('../utils/reports');
const { filterByTimeRange } = require('../utils/date-filter');
const Token = require('../models/Token');
const { emitToDriver } = require('../sockets/utils/driver');
const { ObjectId } = require("mongoose").Types;
const Vehicle = require('../models/Vehicle');

const index = (req, res) => {
    try {
        var page = 1;
        var skip = 0;
        var limit = 20;
        var nextPage;
        var prevPage;
        var filter = {};

        if (req.query.status && req.query.status != null && req.query.status != 'all') {
            if (req.query.status === "active") {
                filter['active'] = true
            } else if (req.query.status === "inactive") {
                filter["active"] = false
            }
        }

        if (req.query.from || req.query.to)
            filter['createdAt'] = filterByTimeRange(req.query.from, req.query.to)

        if (req.query.driverId)
            filter['driver'] = req.query.driverId

        var driverBans = DriverBan.find(filter);
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

        driverBans.sort({ createdAt: 'desc' });
        driverBans.limit(limit);
        driverBans.skip(skip);

        driverBans.populate('driver')

        Promise.all([
            DriverBan.countDocuments(filter),
            driverBans.exec()
        ]).then((value) => {
            if (value) {
                if (((page * limit) <= value[0])) {
                    nextPage = page + 1;
                }
                res.send({ data: value[1], count: value[0], nextPage, prevPage });
            }
        }).catch((error) => {
            logger.error("Driver Ban => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Driver Ban => " + error.toString());
        res.status(500).send(error);
    };
};

const show = async (req, res) => {
    try {
        var ban = await DriverBan.findById(req.params.id);
        res.send(ban);
    } catch (error) {
        logger.error("Driver Ban => " + error.toString());
        res.status(500).send(error);
    };
};

const banDriver = async (req, res) => {
    try {
        const savedBan = await DriverBan.create({
            driver: req.body.driver,
            note: req.body.note ? req.body.note : "",
            active: true,
        });

        try {
            await Driver.updateOne({
                _id: ObjectId(req.body.driver)
            }, { $set: { isBanned: true }})
        } catch(err) {
            console.log(err)
        }
       
        try {
            await Vehicle.updateOne({
                driver: ObjectId(req.body.driver)
            }, { $set: { isBanned: true }})
        } catch(err) {
            console.log(err)
        }

        await Token.deleteMany({
            driver: req.body.driver,
        })
        try {
            await emitToDriver(req.body.driver)("unauthorized");
          } catch { }

        res.send(savedBan);
    } catch (error) {
        logger.error("Driver Ban By Model => " + error.toString());
        res.status(500).send(error);
    }
};

const update = async (req, res) => {
    try {
        const updatedTrip = await DriverBan.updateOne({ '_id': req.params.id }, req.body);
        res.send(updatedTrip);
    } catch (error) {
        logger.error("Driver Ban => " + error.toString());
        res.status(500).send(error);
    }
};

const remove = async (req, res) => {
    try {
        
        const banToDelete = await DriverBan.findOne({ _id: req.params.id })
        
        
        if (banToDelete) {
            const deletedBan = await DriverBan.updateOne({ _id: req.params.id }, {$set:{active: false}});

            try {
                await Driver.updateOne({
                    _id: banToDelete.driver
                }, { $set: { isBanned: false }})
                res.send(deletedBan);
            } catch(err) {
                console.log(err)
                res.status(500).send(err)
            }

            try {
                await Vehicle.updateOne({
                    driver: banToDelete.driver
                }, { $set: { isBanned: false }})
            } catch(err) {
                console.log(err)
            }
        } else {
            res.status(404).send("the ban you're trying to lift doesn't exist")
        }
    } catch (error) {
        logger.error("Driver Ban => " + error.toString());
        res.status(500).send(error);
    }
};

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

        var trip = DriverBan.find(filter);

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
            logger.error("Driver Ban => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Driver Ban => " + error.toString());
        res.status(500).send(error);
    };
};

module.exports = { index, show, banDriver, update, remove, exportReport };
