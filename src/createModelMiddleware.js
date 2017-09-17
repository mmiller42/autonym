import { createErrorMiddleware, createStoreMiddleware } from './middleware'
import { isPlainObject, values } from 'lodash'
import Model from './Model'
import { checkForUnrecognizedProperties } from './utils/index'
import { Router as createRouter } from 'express'

export default async function autonym(_config) {
  const config = normalizeConfig()

  const router = createRouter()

  await initializeModels()

  config.models.forEach(model => {
    router.use(`/${model.getRoute()}`, createStoreMiddleware(model))
  })
  router.use(createErrorMiddleware())

  function normalizeConfig() {
    if (!isPlainObject(_config)) {
      throw new TypeError('config parameter must be a plain object.')
    }
    if (!Array.isArray(_config.models) || !isPlainObject(_config.models)) {
      throw new TypeError('config.models parameter must be an array.')
    }

    checkForUnrecognizedProperties('config', _config, ['models'])

    const normalizedConfig = { ..._config }
    if (!Array.isArray(normalizedConfig.models)) {
      normalizedConfig.models = values(normalizedConfig.models)
    }

    normalizedConfig.models.forEach((model, i) => {
      if (!(model instanceof Model)) {
        throw new TypeError(
          `config.models parameter must be an array of Model instances, but the model at index ${i} is not. Did you forget to wrap your model definition in the autonym.model decorator?`
        )
      }
    })

    return normalizedConfig
  }

  async function initializeModels() {
    await Promise.all(config.models.map(model => model.init()))
  }
}
