import { Router as createRouter } from 'express'
import { isPlainObject, values } from 'lodash'
import { Model } from './model'
import errorMiddleware from './middleware/errorMiddleware'
import modelMiddleware from './middleware/modelMiddleware'
import { checkForUnrecognizedProperties } from './utils/helpers'

export class Autonym {
  static _normalizeConfig(_config) {
    if (!isPlainObject(_config)) {
      throw new TypeError('config parameter must be a plain object.')
    }
    if (!Array.isArray(_config.models) || !isPlainObject(_config.models)) {
      throw new TypeError('config.models parameter must be an array.')
    }

    checkForUnrecognizedProperties('config', _config, ['models'])

    const config = { ..._config }
    if (!Array.isArray(config.models)) {
      config.models = values(config.models)
    }

    config.models.forEach((model, i) => {
      if (!(model instanceof Model)) {
        throw new TypeError(
          `config.models parameter must be an array of Model instances, but the model at index ${i} is not. Did you forget to wrap your model definition in the autonym.model decorator?`
        )
      }
    })

    return config
  }

  constructor(config) {
    this._config = Autonym._normalizeConfig(config)
    this._router = this._createRouter()
  }

  getConfig() {
    return this._config
  }

  getRouter() {
    return this._router
  }

  _createRouter() {
    const router = createRouter()

    this._initializeModels().then(() => {
      this.getConfig().models.forEach(model => {
        router.use(`/${model.getRoute()}`, modelMiddleware(model))
      })
      router.use(errorMiddleware())
    })

    return router
  }

  _initializeModels() {
    return Promise.all(this.getConfig().models.map(model => model.init()))
  }
}

export default function autonym(config) {
  return new Autonym(config).getRouter()
}
