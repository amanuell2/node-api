const express = require('express');
const router = express.Router();
const RolesController = require('../controllers/RolesController');
const requiresPermissions = require('../middleware/adminAuthzMiddleware')
const ROLES = require('../utils/roles')

router.get('/',
    RolesController.index
);

router.get('/:id',

    requiresPermissions({ account: { 'rbac': ['canAccess'] } }), RolesController.show
)

router.post('/',

    requiresPermissions({ account: { 'rbac': ['canAccess'] } }), RolesController.store
)

router.patch('/:id',

    requiresPermissions({ account: { 'rbac': ['canAccess'] } }), RolesController.update
)

router.delete('/:id',

    requiresPermissions({ account: { 'rbac': ['canAccess'] } }), RolesController.remove
)

// router.get('/export',
//     requiresPermissions([
//         ROLES.ADMIN,
//     ]),
//     RolesController.exportReport
// )

module.exports = router;