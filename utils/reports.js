const stream = require('stream')
const activityLogger = require('../services/activity-logger')
const url = require('url')

exports.generateAndSendReport = async ({
  req,
  res,
  fileData,
  fileName
}) => {
  await activityLogger.ADMIN_HAS_EXPORTED_REPORTED({ account: res.locals.user, url: req.originalUrl, path: url.parse(req.originalUrl).pathname })
  const readStream = new stream.PassThrough()
  readStream.end(Buffer.from(fileData.replace(/,/g, ""), 'utf-8'))

  res.set('Content-disposition', 'attachment; filename=' + fileName)
  res.set('Content-Type', 'text/plain')

  readStream.pipe(res)
}
