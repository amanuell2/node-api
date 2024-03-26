const RewardPrize = require('../models/RewardPrize');
const logger = require('../services/logger');

const { generateAndSendReport } = require('../utils/reports');
const { filterByTimeRange } = require('../utils/date-filter');

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

        if (req.query.page && parseInt(req.query.page) != 0) {
            page = parseInt(req.query.page);
        }
        if (req.query.limit) {
            limit = parseInt(req.query.limit);
        }

        if (req.query.available) {
            filter['amountInStock'] = { $gte: 1 }
        }

        if (page > 1) {
            prevPage = page - 1;
        }

        skip = (page - 1) * limit;

        var rewardPrizes = RewardPrize.find(filter);
        rewardPrizes.sort({ createdAt: 'desc' });
        rewardPrizes.limit(limit);
        rewardPrizes.skip(skip);

        Promise.all([
            RewardPrize.countDocuments(filter),
            rewardPrizes.exec()
        ]).then((value) => {
            if (value) {
                if (((page * limit) <= value[0])) {
                    nextPage = page + 1;
                }
                res.send({ data: value[1], count: value[0], nextPage, prevPage });
            }
        }).catch((error) => {
            logger.error("Reward Prize Inventory => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Reward Prize Inventory => " + error.toString());
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

        var trip = RewardPrize.find(filter);

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
            logger.error("Reward Prize Inventory => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Reward Prize Inventory => " + error.toString());
        res.status(500).send(error);
    };
};

const show = async (req, res) => {
    try {
        const prize = await RewardPrize.findById(req.params.id)
        if (prize) {
            res.status(200).json(prize)
        } else {
            res.status(404).send('prize not found')
        }
    } catch (error) {
        logger.error('Reward Prize Inventory => ' + error.toString())
        res.status(500).send(error)
    }
}

const store = async (req, res) => {
    try {
        const savedPrize = await RewardPrize.create(req.body)
        res.send(savedPrize)
    } catch (error) {
        logger.error('Reward Prize Inventory => ' + error.toString())
        res.status(500).send(error)
    }
}

const update = async (req, res) => {
    try {
        delete req.body._id
        const updatedPrize = await RewardPrize.updateOne({
            _id: ObjectId(req.params.id)
        }, req.body)
        res.send(updatedPrize)
    } catch (error) {
        logger.error('Reward Prize Inventory => ' + error.toString())
        res.status(500).send(error)
    }
}

module.exports = { index, exportReport, store, update, show };
