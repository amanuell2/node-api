const express = require('express');
const router = express.Router({ mergeParams: true });
const CorporateRolesController = require('../controllers/CorporateRolesController');
const requiresPermissions = require('../middleware/adminAuthzMiddleware')

router.get('/',
    requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }), 
    CorporateRolesController.index
);

router.get('/:id',
    requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),
    CorporateRolesController.show
)

router.post('/',
    requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),

    CorporateRolesController.store
)

router.patch('/:id',
    requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),

    CorporateRolesController.update
)

router.delete('/:id',
    requiresPermissions({ account: { 'corporate-management': ['canAccess'] } }),

    CorporateRolesController.remove
)

// router.get('/export',
//     requiresPermissions([
//         ROLES.ADMIN,
//     ]),
//     CorporateRolesController.exportReport
// )

module.exports = router;