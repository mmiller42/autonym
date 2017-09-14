export class Responder {
  static _sendResponse(error, req, res, next) {
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

  constructor() {
    this._createRouter()
  }

  getRouter() {
    return this._router
  }

  _createRouter() {
    this._router = [
      (req, res, next) => Responder._sendResponse(null, req, res, next),
      (error, req, res, next) => Responder._sendResponse(error, req, res, next),
    ]
  }
}

export default function responder() {
  return new Responder().getRouter()
}
