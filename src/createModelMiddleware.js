import { createErrorMiddleware, createStoreMiddleware } from './middleware'
import { isPlainObject, values } from 'lodash'
import Model from './Model'
import { checkForUnrecognizedProperties } from './utils'
import { Router as createRouter } from 'express'

/**
 * Creates an Express middleware router that binds routes for all of the given models.
 * @param {object} config Configuration.
 * @param {Model[]|object.<string, Model>} config.models A collection of model instances. This may be an object or
 * an array, but if it is an object, the keys will be ignored.
 * @returns {Promise.<Router, Error>} A promise that resolves with an Express router. The router has an additional
 * property `modelInitializations` which is an array of promises, in case you want to capture errors from the init
 * functions.
 * @example
 * app.use(createModelMiddleware({
 *   models: [Post, User],
 * }))
 * @example
 * const modelMiddleware = createModelMiddleware({
 *   models: [Post, User],
 * })
 * app.use(modelMiddleware)
 *
 * Promise.all(modelMiddleware.modelInitializations).catch(err => {
 *   console.error(err)
 *   process.exit(1)
 * })
 */
export default function createModelMiddleware(config) {
  const normalizedConfig = normalizeConfig(config)

  const router = createRouter()
  router.modelInitializations = normalizedConfig.models.map(model => model.init())

  normalizedConfig.models.forEach(model => {
    router.use(`/${model.getRoute()}`, createStoreMiddleware(model))
  })
  router.use(createErrorMiddleware())

  return router
}

function normalizeConfig(config) {
  if (!isPlainObject(config)) {
    throw new TypeError('config parameter must be a plain object.')
  }
  if (!Array.isArray(config.models) && !isPlainObject(config.models)) {
    throw new TypeError('config.models parameter must be an array.')
  }

  checkForUnrecognizedProperties('config', config, ['models'])

  const normalizedConfig = { ...config }
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
