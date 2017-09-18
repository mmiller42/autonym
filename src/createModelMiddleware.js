/** @module */

import { createErrorMiddleware, createStoreMiddleware } from './middleware'
import { isPlainObject, values } from 'lodash'
import Model from './Model'
import { checkForUnrecognizedProperties } from './utils/index'
import { Router as createRouter } from 'express'

/**
 * Creates an Express middleware router that binds routes for all of the given models.
 * @param {object} _config Configuration.
 * @param {Model[]|object.<string, Model>} _config.models A collection of model instances. This may be an object or
 * an array, but if it is an object, the keys will be ignored.
 * @returns {Promise.<Router>} A promise that resolves with an Express router.
 */
export default async function createModelMiddleware(_config) {
  const config = normalizeConfig()

  const router = createRouter()

  await initializeModels()

  config.models.forEach(model => {
    router.use(`/${model.getRoute()}`, createStoreMiddleware(model))
  })
  router.use(createErrorMiddleware())

  return router

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
