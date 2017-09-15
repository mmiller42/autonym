export default function createResponderMiddleware() {
  return [
    (req, res, next) => sendResponse(null, req, res, next),
    (error, req, res, next) => sendResponse(error, req, res, next),
  ]

  function sendResponse(error, req, res, next) {
    if (!res.autonym) {
      next(error)
      return
    }

    res.status(res.autonym.getStatus())
    const data = res.autonym.getData()
    if (data === null) {
      res.end()
    } else {
      res.json(data)
    }

    next(error)
  }
}
