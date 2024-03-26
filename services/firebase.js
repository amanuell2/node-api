const path = require('path')
const admin = require('firebase-admin')

// const serviceAccountPath = path.join(__dirname, '../testServiceAccountKey.json')
const serviceAccountPath = path.join(__dirname, '../prodServiceAccountKey.json')

const serviceAccount = require(serviceAccountPath)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

module.exports = {
  firebaseAuth: admin.auth
}
