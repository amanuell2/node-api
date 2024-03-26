const express = require('express')
const router = express.Router()
const LeaderboardController = require('../controllers/PassengerLeaderboardController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
    requiresPermissions({ account: { 'passengers-leaderboard': ['canAccess'] } }),
    LeaderboardController.index
)

module.exports = router
