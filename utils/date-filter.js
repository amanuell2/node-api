exports.filterByTimeRange = function (from, to) {
  const filter = {}

  if (from) { from = new Date(from).toISOString().slice(0, 10) }
  if (to) {
    to = new Date(to).toISOString().slice(0, 10)
    const nextDay = new Date(to)
    nextDay.setDate(new Date(to).getDate() + 1)
    to = nextDay
  }

  if (from && from != 'all' && to && to != 'all') {
    filter.$gte = new Date(from)
    filter.$lt = new Date(to)
  } else if (to && to != 'all') {
    filter.$gte = new Date(to)
  } else if (from && from != 'all') {
    filter.$gte = new Date(from)
  } else {
    filter.$gte = new Date(1900, 1, 1) // allow every
  }

  return filter
}
