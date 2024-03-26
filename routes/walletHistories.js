const express = require('express')
const router = express.Router()
const WalletHistoryController = require('../controllers/WalletHistoryController')

const ROLES = require('../utils/roles')
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
    requiresPermissions({ account: { 'wallet-managment': ['canAccess'] } }),
    WalletHistoryController.index
)
router.get('/export',
    requiresPermissions({ account: { 'wallet-managment': ['canAccess'] } }),
    WalletHistoryController.exportReport
)
router.get('/:id',
    requiresPermissions({ account: { 'wallet-managment': ['canAccess'] } }),
    WalletHistoryController.bankDepositDetail
)

router.post('/:id/mark-paid',
    requiresPermissions({ account: { 'wallet-managment': ['canAccess'] } }),
    WalletHistoryController.markDepositAsPaid
)

module.exports = router
