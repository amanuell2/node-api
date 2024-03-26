const ActivityLog = require('../models/ActivityLog');
const logger = require('../services/logger');
const activityLogger = require('../services/activity-logger')

const activityLogTypes = require('../constants/activitylogs')

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

        if (req.query.actionCode && req.query.actionCode != null && req.query.actionCode != 'all') {
            filter['actionCode'] = req.query.actionCode;
        }

        if (req.query.actor && req.query.actor != null) {
            filter['subjectModel'] = req.query.actor;
        }

        if (req.query.actorId && req.query.actorId != null) {
            filter['subject'] = req.query.actorId;
        }

        // if (req.query.log && req.query.log != null) {
        //     filter['$text'] = { $search: req.query.log }
        // }

        if (req.query.from || req.query.to)
            filter['createdAt'] = filterByTimeRange(req.query.from, req.query.to)

        var activityLogs = ActivityLog.find(filter);
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
            ActivityLog.countDocuments(filter),
            activityLogs.exec()
        ]).then((value) => {
            if (value) {
                if (((page * limit) <= value[0])) {
                    nextPage = page + 1;
                }
                res.send({ data: value[1], count: value[0], nextPage, prevPage });
            }
        }).catch((error) => {
            logger.error("Activity Log => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Activity Log => " + error.toString());
        res.status(500).send(error);
    };
};

const activityTypes = (req, res) => {
    try {
        res.status(200).json(Object.values(activityLogTypes))
    } catch (error) {
        logger.error("Activity Log => " + error.toString());
        res.status(500).send(error);
    };
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

        var trip = ActivityLog.find(filter);

        trip.populate()
        trip.sort({ pickupTimestamp: 'desc' });

        ["driver", "passenger", "vehicleType", "dispatcher"].forEach(model => trip.populate(model))

        trip.exec().then(async (tripRecords) => {
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
            logger.error("Activity Log => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Activity Log => " + error.toString());
        res.status(500).send(error);
    };
};

module.exports = { index, activityTypes, exportReport };
