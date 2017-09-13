import { cloneDeep, defaultsDeep, difference, forEach, isPlainObject, kebabCase, noop } from 'lodash'
import { pluralize } from 'inflection'
import Ajv from 'ajv'
import maybePromiseFactory from 'maybe-promise-factory'
import { POST_SCHEMA, POST_STORE, PRE_SCHEMA } from './utils/policyHookConstants'
import AutonymError from './utils/AutonymError'

const STORE_METHODS = ['create', 'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete']
const POLICY_LIFECYCLE_HOOKS = [PRE_SCHEMA, POST_SCHEMA, POST_STORE]
const maybePromise = maybePromiseFactory()

export class Model {
  static _normalizeConfig(_config) {
    if (!isPlainObject(_config)) {
      throw new TypeError('config parameter passed to autonym.model decorator must be a plain object.')
    }

    const { name } = _config

    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('config.name parameter passed to autonym.model decorator must be a non-empty string.')
    }
    if (_config.init !== undefined && typeof _config.init !== 'function') {
      throw new TypeError('config.init parameter passed to autonym.model decorator must be a function or undefined.')
    }
    if (!isPlainObject(_config.schema) && _config.schema !== null) {
      throw new TypeError('config.schema parameter passed to autonym.model decorator must be a JSON schema or explicitly null.')
    }
    if (_config.ajvOptions !== undefined && !isPlainObject(_config.ajvOptions)) {
      throw new TypeError('config.ajvOptions parameter passed to autonym.model decorator must be a plain object or undefined.')
    }
    if (_config.policies !== undefined && !isPlainObject(_config.policies)) {
      throw new TypeError('config.policies parameter passed to autonym.model decorator must be a plain object or undefined.')
    }
    if (!isPlainObject(_config.store)) {
      throw new TypeError('config.store parameter passed to autonym.model decorator must be a plain object.')
    }
    if (_config.route !== undefined && (typeof _config.route !== 'string' || _config.route === 0)) {
      throw new TypeError('config.route parameter passed to autonym.model decorator must be a non-empty string or undefined.')
    }
    if (_config.serialize !== undefined && typeof _config.serialize !== 'function') {
      throw new TypeError('config.serialize parameter passed to autonym.model decorator must be a function or undefined.')
    }
    if (_config.unserialize !== undefined && typeof _config.unserialize !== 'function') {
      throw new TypeError('config.unserialize parameter passed to autonym.model decorator must be a function or undefined.')
    }

    this._checkForUnrecognizedProperties('config', _config, ['name', 'schema', 'ajvOptions', 'policies', 'store', 'route', 'serialize', 'unserialize'])
    this._checkForUnrecognizedProperties('config.policies', _config.policies, POLICY_LIFECYCLE_HOOKS)
    forEach(_config.policies, (hooks, hook) => this._checkForUnrecognizedProperties(`config.policies.${hook}`, hooks, STORE_METHODS))

    const config = defaultsDeep({}, _config, {
      init: noop,
      schema: null,
      ajvOptions: {
        allErrors: true,
        format: 'full',
        removeAdditional: true,
        useDefaults: true,
        errorDataPath: 'property',
      },
      policies: POLICY_LIFECYCLE_HOOKS.reduce((hooks, hook) => {
        hooks[hook] = STORE_METHODS.reduce((methods, method) => {
          methods[method] = true
          return methods
        }, {})
        return hooks
      }, {}),
      store: STORE_METHODS.reduce((methods, method) => {
        methods[method] = () => Promise.reject(new AutonymError(AutonymError.METHOD_NOT_ALLOWED, `${method} is not implemented for model "${name}".`))
        return methods
      }, {}),
      route: pluralize(kebabCase(name)),
      serialize: cloneDeep,
      unserialize: cloneDeep,
    })

    const { init } = config
    config.init = () => maybePromise(init)

    if (config.schema) {
      const validateAgainstSchema = new Ajv(config.ajvOptions).compile(config.schema)
      config.validateAgainstSchema = data => {
        if (validateAgainstSchema(data)) {
          return Promise.resolve()
        } else {
          return Promise.reject(new AutonymError(AutonymError.NOT_ACCEPTABLE, `Schema validation for model "${name}" failed.`, validateAgainstSchema.ajvErrors))
        }
      }
    } else {
      config.validateAgainstSchema = () => Promise.resolve()
    }

    const { serialize, unserialize } = config
    config.serialize = data => maybePromise(() => serialize(data))
    config.unserialize = data => maybePromise(() => unserialize(data))

    return config
  }

  static _checkForUnrecognizedProperties(parameterName, object, expectedProperties) {
    const invalidKeys = difference(Object.keys(object), expectedProperties)
    if (invalidKeys.length !== 0) {
      throw new TypeError(`Unexpected properties on ${parameterName} parameter passed to autonym.model decorator: "${invalidKeys.join('", "')}".`)
    }
  }

  constructor(config) {
    this._config = Model._normalizeConfig(config)
    this._hooks = POLICY_LIFECYCLE_HOOKS.reduce((hooks, hook) => {
      hooks[hook] = () => Promise.resolve()
      return hooks
    }, {})
    this._initialization = null
  }

  getConfig() {
    return this._config
  }

  getName() {
    return this.getConfig().name
  }

  getRoute() {
    return this.getConfig().route
  }

  init() {
    if (!this._initialization) {
      this._initialization = this.getConfig().init()
    }
    return this._initialization
  }

  create(data, meta, hookArgs) {
    return this._callWithHooks(data, hookArgs, () => this.getConfig().store.create(this.serialize(data), meta)).then(_data => this.unserialize(_data))
  }

  find(query, filters, meta, hookArgs) {
    return this._callWithHooks(null, hookArgs, () =>
      this.getConfig()
        .store.find(query, filters, meta)
        .then(dataSet => dataSet.map(data => this.unserialize(data)))
    )
  }

  findOne(id, filters, meta, hookArgs) {
    return this._callWithHooks(null, hookArgs, () =>
      this.getConfig()
        .store.findOne(id, filters, meta)
        .then(data => this.unserialize(data))
    )
  }

  findOneAndUpdate(id, data, completeData, filters, meta, hookArgs) {
    return this._callWithHooks(completeData, hookArgs, () =>
      this.getConfig()
        .store.findOneAndUpdate(id, this.serialize(data), this.serialize(completeData), filters, meta)
        .then(_data => this.unserialize(_data))
    )
  }

  findOneAndDelete(id, filters, meta, hookArgs) {
    return this._callWithHooks(null, hookArgs, () => this.getConfig().store.findOneAndDelete(id, filters, meta))
  }

  serialize(data) {
    return this.getConfig().serialize(data)
  }

  unserialize(data) {
    return this.getConfig().unserialize(data)
  }

  validateAgainstSchema(data) {
    return this.getConfig().validateAgainstSchema(data)
  }

  withHooks(hooks) {
    return {
      ...this,
      _hooks: hooks,
    }
  }

  runHook(hook, hookArgs = []) {
    const validate = this._hooks[hook]
    if (!validate) {
      throw new TypeError(`Unknown policy hook "${hook}".`)
    }
    return validate(...hookArgs).then(() => Promise.resolve())
  }

  _callWithHooks(data, hookArgs, fn) {
    return this.runHook(PRE_SCHEMA, hookArgs)
      .then(() => (data ? this.validateAgainstSchema(data) : Promise.resolve()))
      .then(() => this.runHook(POST_SCHEMA, hookArgs))
      .then(fn)
      .then(result => this.runHook(POST_STORE, [...hookArgs, result]))
      .catch(err => {
        throw AutonymError.fromError(err)
      })
  }
}

export default function model(config) {
  return new Model(config)
}
