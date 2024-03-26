const Role = require('../models/Role');
const logger = require('../services/logger');

const { generateAndSendReport } = require('../utils/reports');
const { filterByTimeRange } = require('../utils/date-filter');

const { ObjectId } = require('mongoose').Types

const index = (req, res) => {
    try {
        var roles = Role.find({});
        roles.sort({ createdAt: 'asc' });
        
        roles.exec().then((value) => {
            res.send({ data: value });
        }).catch((error) => {
            logger.error("Roles => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Roles => " + error.toString());
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

        var trip = Role.find(filter);

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
            logger.error("Roles => " + error.toString());
            res.status(500).send(error);
        });
    } catch (error) {
        logger.error("Roles => " + error.toString());
        res.status(500).send(error);
    };
};

const show = async (req, res) => {
    try {
        const role = await Role.findById(req.params.id)
        if (role) {
            res.status(200).json(role)
        } else {
            res.status(404).send('role not found')
        }
    } catch (error) {
        logger.error('Roles => ' + error.toString())
        res.status(500).send(error)
    }
}

const store = async (req, res) => {
    try {
        if (req.body.permissions) {
            req.body.permissions['rbac'].canAccess = false
        }
        const savedRole = await Role.create(req.body)
        res.send(savedRole)
    } catch (error) {
        logger.error('Roles => ' + error.toString())
        res.status(500).send(error)
    }
}

const update = async (req, res) => {
    try {
        delete req.body._id
        // delete req.params.permissions.rbac

        const roleToUpdate = await Role.findOne({
            _id: ObjectId(req.params.id)
        }, { roleName: 1 })

        if (req.body.permissions) {
            req.body.permissions['rbac'].canAccess = roleToUpdate.roleName === "Super Admin"
            
            console.log("updating ", roleToUpdate.roleName)

            console.log("rbac =>", req.body.permissions['rbac'].canAccess)
        }


        if (!roleToUpdate) {
            return res.status(404).send("ROLE_DOES_NOT_EXIST")
        } else if (roleToUpdate.roleName === "Super Admin") {
            return res.status(409).send("CANNOT_REMOVE_SUPER_ADMIN_ROLE")
        } else {
            const updatedRole = await Role.updateOne({
                _id: ObjectId(req.params.id)
            }, { $set: req.body })
            res.send(updatedRole)
        }
    } catch (error) {
        logger.error('Roles => ' + error.toString())
        res.status(500).send(error)
    }
}

const remove = async (req, res) => {
    try {
        const roleToDelete = await Role.findOne({
            _id: ObjectId(req.params.id)
        }, { roleName: 1 })

        if (!roleToDelete) {
            return res.status(404).send("ROLE_DOES_NOT_EXIST")
        } else if (roleToDelete.roleName === "Super Admin") {
            return res.status(409).send("CANNOT_REMOVE_SUPER_ADMIN_ROLE")
        } else {
            const deletedRole = await Role.deleteOne({
                _id: ObjectId(req.params.id)
            })
            res.send(deletedRole)
        }
    } catch (error) {
        logger.error('Roles => ' + error.toString())
        res.status(500).send(error)
    }
}

module.exports = { index, exportReport, store, update, show, remove };
