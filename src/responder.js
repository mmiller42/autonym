import { isPlainObject } from 'lodash'

export class Responder {
  static _normalizeConfig(config) {
    if (!isPlainObject(config)) {
      throw new TypeError('config parameter passed to autonym.responder function must be a plain object.')
    }
    if (config.handleError !== undefined && typeof config.handleError !== 'function') {
      throw new TypeError('config.handleError parameter passed to autonym.responder function must be a function or undefined.')
    }

    return config
  }

  constructor(config) {
    this._config = Responder._normalizeConfig(config)
    this._createRouter()
  }

  getConfig() {
    return this._config
  }

  getRouter() {
    return this._router
  }

  _createRouter() {
    this._router = [(req, res, next) => this._sendResponse(null, res, next), (error, req, res, next) => this._sendResponse(error, res, next)]
  }

  _sendResponse(error, res, next) {
    const { handleError } = this.getConfig()
    if (handleError) {
      handleError(error)
    }

    if (!res.autonym.isSent()) {
      res.status(res.autonym.getStatus())
      const data = res.autonym.getData()
      if (data !== undefined && data !== null) {
        res.json(data)
      } else if (data === null) {
        res.end()
      } else if (error && !handleError) {
        next(error)
      } else {
        next()
      }
    }
  }
}

export default function responder(config) {
  return new Responder(config).getRouter()
}
