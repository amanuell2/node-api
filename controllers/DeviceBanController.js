const DeviceBan = require('../models/DeviceBan');
const logger = require('../services/logger');

const { generateAndSendReport } = require('../utils/reports');
const { filterByTimeRange } = require('../utils/date-filter');


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

        if (req.query.selectedDeviceModelID)
            filter['deviceModelID'] = {
                $regex: req.query.selectedDeviceModelID, $options: 'i'
            }

        if (req.query.driverId)
            filter['driver'] = req.query.driverId

        if (req.query.allDevicesOfTheModel && ['true', 'false'].includes(req.query.allDevicesOfTheModel))
            filter['allDevicesOfTheModel'] = req.query.allDevicesOfTheModel === 'true'

        var deviceBans = DeviceBan.find(filter);
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

        deviceBans.sort({ createdAt: 'desc' });
        deviceBans.limit(limit);
        deviceBans.skip(skip);

        deviceBans.populate('driver')

        Promise.all([
            DeviceBan.countDocuments(filter),
            deviceBans.exec()
        ]).then((value) => {
            if (value) {
                if (((page * limit) <= value[0])) {
                    nextPage = page + 1;
                }
                res.send({ data: value[1], count: value[0], nextPage, prevPage });
            }
        }).catch((error) => {
            logger.error("Device Ban => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Device Ban => " + error.toString());
        res.status(500).send(error);
    };
};

const show = async (req, res) => {
    try {
        var ban = await DeviceBan.findById(req.params.id);
        res.send(ban);
    } catch (error) {
        logger.error("Device Ban => " + error.toString());
        res.status(500).send(error);
    };
};

const banModel = async (req, res) => {
    try {
        const savedBan = await DeviceBan.create({
            deviceModelID: req.body.deviceModelID,
            deviceID: null,
            driver: null,
            note: req.body.note,
            allDevicesOfTheModel: true,
        });
        res.send(savedBan);
    } catch (error) {
        logger.error("Device Ban By Model => " + error.toString());
        res.status(500).send(error);
    }
};

const banDevice = async (req, res) => {
    try {
        const savedBan = await DeviceBan.create({
            deviceID: req.body.deviceID,
            deviceModelID: req.body.deviceModelID,
            driver: req.body.driverID,
            note: req.body.note,
            allDevicesOfTheModel: false,
        });
        res.send(savedBan);
    } catch (error) {
        logger.error("Device Ban By ID => " + error.toString());
        if (error.name && error.name === "MongoError" && error.code === 11000) {
            res.status(409).send("device already banned")
        } else {
            res.status(500).send("something went wrong");
        }
    }
};

const update = async (req, res) => {
    try {
        const updatedTrip = await DeviceBan.updateOne({ '_id': req.params.id }, req.body);
        res.send(updatedTrip);
    } catch (error) {
        logger.error("Device Ban => " + error.toString());
        res.status(500).send(error);
    }
};

const remove = async (req, res) => {
    try {
        const deletedTrip = await DeviceBan.remove({ _id: req.params.id });
        res.send(deletedTrip);
    } catch (error) {
        logger.error("Device Ban => " + error.toString());
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

        var trip = DeviceBan.find(filter);

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
            logger.error("Device Ban => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Device Ban => " + error.toString());
        res.status(500).send(error);
    };
};

module.exports = { index, show, banModel, banDevice, update, remove, exportReport };
