import { cloneDeep, defaultsDeep, forEach, isPlainObject, kebabCase, mapValues, noop } from 'lodash'
import Ajv from 'ajv'
import AutonymError from './AutonymError'
import { checkForUnrecognizedProperties } from './utils/index'
import { pluralize } from 'inflection'

const STORE_METHODS = ['create', 'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete']
const POLICY_LIFECYCLE_HOOKS = ['preSchema', 'postSchema', 'postStore']

export default class Model {
  static _normalizeConfig(_config) {
    if (!isPlainObject(_config)) {
      throw new TypeError('config parameter must be a plain object.')
    }

    const { name } = _config

    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('config.name parameter must be a non-empty string.')
    }
    if (_config.init !== undefined && typeof _config.init !== 'function') {
      throw new TypeError('config.init parameter must be a function or undefined.')
    }
    if (_config.schema !== null && !isPlainObject(_config.schema)) {
      throw new TypeError('config.schema parameter must be a JSON schema or explicitly null.')
    }
    if (_config.schema && _config.schema.type !== 'object') {
      throw new TypeError('config.schema.type parameter must be object.')
    }
    if (_config.ajvOptions !== undefined && !isPlainObject(_config.ajvOptions)) {
      throw new TypeError('config.ajvOptions parameter must be a plain object or undefined.')
    }
    if (_config.policies !== undefined && !isPlainObject(_config.policies)) {
      throw new TypeError('config.policies parameter must be a plain object or undefined.')
    }
    if (!isPlainObject(_config.store)) {
      throw new TypeError('config.store parameter must be a plain object.')
    }
    if (_config.route !== undefined && (typeof _config.route !== 'string' || _config.route === 0)) {
      throw new TypeError('config.route parameter must be a non-empty string or undefined.')
    }
    if (_config.serialize !== undefined && typeof _config.serialize !== 'function') {
      throw new TypeError('config.serialize parameter must be a function or undefined.')
    }
    if (_config.unserialize !== undefined && typeof _config.unserialize !== 'function') {
      throw new TypeError('config.unserialize parameter must be a function or undefined.')
    }
    if (_config.initialMeta !== undefined && !isPlainObject(_config.initialMeta)) {
      throw new TypeError('config.initialMeta parameter must be a plain object or undefined.')
    }

    checkForUnrecognizedProperties('config', _config, [
      'name',
      'schema',
      'ajvOptions',
      'policies',
      'store',
      'route',
      'serialize',
      'unserialize',
    ])
    checkForUnrecognizedProperties('config.policies', _config.policies, POLICY_LIFECYCLE_HOOKS)
    forEach(_config.policies, (hooks, hook) =>
      checkForUnrecognizedProperties(`config.policies.${hook}`, hooks, STORE_METHODS)
    )

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
        methods[method] = () => {
          throw new AutonymError(AutonymError.METHOD_NOT_ALLOWED, `${method} is not implemented for model "${name}".`)
        }
        return methods
      }, {}),
      route: pluralize(kebabCase(name)),
      serialize: cloneDeep,
      unserialize: cloneDeep,
      initialMeta: {},
    })

    const { init } = config
    config.init = async () => init()

    if (config.schema) {
      const validateAgainstSchema = new Ajv(config.ajvOptions).compile(config.schema)
      config.validateAgainstSchema = async data => {
        if (!validateAgainstSchema(data)) {
          throw new AutonymError(AutonymError.NOT_ACCEPTABLE, `Schema validation for model "${name}" failed.`, {
            errors: validateAgainstSchema.ajvErrors,
          })
        }
      }
    } else {
      config.validateAgainstSchema = async () => undefined
    }

    config.store = mapValues(config.store, method => async (...args) => method.apply(config.store, args))

    const { serialize, unserialize } = config
    config.serialize = async data => serialize(data)
    config.unserialize = async data => unserialize(data)

    return config
  }

  constructor(config) {
    this._config = Model._normalizeConfig(config)
    this._hooks = POLICY_LIFECYCLE_HOOKS.reduce((hooks, hook) => {
      hooks[hook] = async () => undefined
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

  getInitialMeta() {
    return this.getConfig().initialMeta
  }

  getPolicies() {
    return this.getConfig().policies
  }

  async init() {
    if (!this._initialization) {
      this._initialization = this.getConfig().init()
    }
    return this._initialization
  }

  async create(data, meta, hookArgs) {
    const serializedData = await this.serialize(data)

    const runner = this._callWithHooks(data, hookArgs)
    await runner.next()

    const result = await this.getConfig().store.create(serializedData, meta)
    await runner.next(result)

    return this.unserialize(result)
  }

  async find(query, meta, hookArgs) {
    const runner = this._callWithHooks(null, hookArgs)
    await runner.next()

    const results = await this.getConfig().store.find(query, meta)
    await runner.next(results)

    return Promise.all(results.map(async result => this.unserialize(result)))
  }

  async findOne(id, meta, hookArgs) {
    const runner = this._callWithHooks(null, hookArgs)
    await runner.next()

    const result = await this.getConfig().store.findOne(id, meta)
    await runner.next(result)

    return this.unserialize(result)
  }

  async findOneAndUpdate(id, data, completeData, meta, hookArgs) {
    const [serializedData, serializedCompleteData] = await Promise.all([
      this.serialize(data),
      this.serialize(completeData),
    ])

    const runner = this._callWithHooks(completeData, hookArgs)
    await runner.next()

    const result = await this.getConfig().store.findOneAndUpdate(id, serializedData, serializedCompleteData, meta)
    await runner.next(result)

    return this.unserialize(result)
  }

  async findOneAndDelete(id, meta, hookArgs) {
    const runner = this._callWithHooks(null, hookArgs)
    await runner.next()

    await this.getConfig().store.findOneAndDelete(id, meta)
    const result = { id }
    await runner.next(result)

    return this.unserialize(result)
  }

  async serialize(data) {
    return this.getConfig().serialize(data)
  }

  async unserialize(data) {
    return this.getConfig().unserialize(data)
  }

  async validateAgainstSchema(data) {
    return this.getConfig().validateAgainstSchema(data)
  }

  withHooks(hooks) {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this, { _hooks: hooks })
  }

  async *_callWithHooks(data, hookArgs) {
    try {
      await this.init()
      await this._hooks.preSchema(...hookArgs)
      if (data) {
        await this.validateAgainstSchema(data)
      }
      await this._hooks.postSchema(...hookArgs)

      const result = yield

      await this._hooks.postStore(...hookArgs, result)
    } catch (err) {
      throw AutonymError.fromError(err)
    }
  }
}
