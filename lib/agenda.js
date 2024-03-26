const { Agenda } = require('agenda')

const agenda = new Agenda({
  db: { address: process.env.DB_CONNECTION, collection: 'tasks', options: { useUnifiedTopology: true, useNewUrlParser: true, }},  
})

agenda.on('ready', function () {
  console.log('Ok Lets get start')
  agenda.start()
})

async function graceful () {
  console.log('stopping tasks...')
  await agenda.stop()
  process.exit(0)
}

process.on('SIGTERM', graceful)
process.on('SIGINT', graceful)

module.exports = agenda
