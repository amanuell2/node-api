const RewardPackage = require('../models/RewardPackage');
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

        if (req.query.balance) {
            filter['minimumWalletAmountToQualify'] = { $lte: req.query.balance }
        }

        if (page > 1) {
            prevPage = page - 1;
        }

        skip = (page - 1) * limit;

        var rewardPackages = RewardPackage.find(filter);
        rewardPackages.sort({ createdAt: 'desc' });
        rewardPackages.limit(limit);
        rewardPackages.skip(skip);

        rewardPackages.populate('prizes')
        
        Promise.all([
            RewardPackage.countDocuments(filter),
            rewardPackages.exec()
        ]).then((value) => {
            if (value) {
                if (((page * limit) <= value[0])) {
                    nextPage = page + 1;
                }
                res.send({ data: value[1], count: value[0], nextPage, prevPage });
            }
        }).catch((error) => {
            logger.error("Reward Packages => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Reward Packages => " + error.toString());
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

        var trip = RewardPackage.find(filter);

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
            logger.error("Reward Packages => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Reward Packages => " + error.toString());
        res.status(500).send(error);
    };
};

const show = async (req, res) => {
    try {
        const prize = await RewardPackage.findById(req.params.id).populate('prizes')

        if (prize) {
            res.status(200).json(prize)
        } else {
            res.status(404).send('prize not found')
        }
    } catch (error) {
        logger.error('Reward Packages => ' + error.toString())
        res.status(500).send(error)
    }
}

const store = async (req, res) => {
    try {
        const savedPackage = await RewardPackage.create(req.body)
        res.send(savedPackage)
    } catch (error) {
        logger.error('Reward Packages => ' + error.toString())
        res.status(500).send(error)
    }
}

const update = async (req, res) => {
    try {
        delete req.body._id
        const updatedPackage = await RewardPackage.updateOne({
            _id: ObjectId(req.params.id)
        }, req.body)
        res.send(updatedPackage)
    } catch (error) {
        logger.error('Reward Packages => ' + error.toString())
        res.status(500).send(error)
    }
}

const deletePackage = async (req, res) => {
    try {
        await RewardPackage.deleteOne({
            _id: ObjectId(req.params.id)
        })
        res.status(200).send('deleted successfully')
    } catch (error) {
        logger.error('Reward Packages => ' + error.toString())
        res.status(500).send(error)
    }
}

module.exports = { index, exportReport, store, update, show, deletePackage };
