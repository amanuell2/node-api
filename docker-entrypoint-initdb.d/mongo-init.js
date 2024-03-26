print('####################### [SCRIPT STARTED] ##########################')

db = db.getSiblingDB('admin')
try {
  db.createUser(
    {
      user: 'ilift_admin',
      pwd: 'Rzc**DuFD8CY',
      roles: ['root']
    }
  )
} catch (err) {
  print('Admin user already created')
  db.auth('ilift_admin', 'Rzc**DuFD8CY')
}
print('############################ [DONE] ###############################')
