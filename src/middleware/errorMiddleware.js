import AutonymError from '../utils/AutonymError'

export class ErrorMiddleware {
  constructor() {
    this._createRouter()
  }

  getRouter() {
    return this._router
  }

  _createRouter() {
    this._router = (_error, req, res, next) => {
      if (!res.autonym) {
        next(_error)
        return
      }

      const error = AutonymError.fromError(_error)
      res.autonym.setStatus(error.getStatus())
      res.autonym.setData(error.getPayload())

      next(error)
    }
  }
}

export default function errorMiddleware() {
  return new ErrorMiddleware().getRouter()
}
