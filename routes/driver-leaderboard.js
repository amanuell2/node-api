const express = require('express')
const router = express.Router()
const LeaderboardController = require('../controllers/DriverLeaderboardController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
    requiresPermissions({ account: { 'drivers-leaderboard': ['canAccess'] } }),
    LeaderboardController.index
)

module.exports = router
