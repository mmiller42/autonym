/** @module */

import { checkForUnrecognizedProperties, cloneInstance } from './utils/index'
import { cloneDeep, defaultsDeep, forEach, isPlainObject, kebabCase, mapValues, noop } from 'lodash'
import Ajv from 'ajv'
import AutonymError from './AutonymError'
import { pluralize } from 'inflection'

const STORE_METHODS = ['create', 'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete']
const POLICY_LIFECYCLE_HOOKS = ['preSchema', 'postSchema', 'postStore']

/**
 * Class that defines an entity type for a resource accessible in your API.
 */
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
      'init',
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

  /**
   * @param {object} config Configuration.
   * @param {string} config.name A unique name for the model, like `'user'`.
   * @param {Model~init} [config.init] A function to call when the model is first used.
   * @param {object|null} config.schema A JSON schema to validate data against before passing it to the store
   * methods, or explicitly `null` to disable schema validation.
   * @param {object} [config.ajvOptions] Additional options to pass to the
   * [https://github.com/epoberezkin/ajv](Ajv) instance.
   * @param {object} [config.policies] Configuration policies.
   * @param {PolicyLifecycleHook} [config.policies.preSchema] A map of store method to policy expression of
   * the policies to run before schema validation. These policies are run whether the model has a defined schema or not.
   * @param {PolicyLifecycleHook} [config.policies.postSchema] A map of store method to policy expression of
   * the policies to run after schema validation. These policies are run whether the model has a defined schema or not.
   * @param {PolicyLifecycleHook} [config.policies.postStore] A map of store method to policy expression of
   * the policies to run after the store method is called.
   * @param {object} config.store Configuration store.
   * @param {Model~create} [config.store.create] A function called to create a new resource.
   * @param {Model~find} [config.store.find] A function called to find resources.
   * @param {Model~findOne} [config.store.findOne] A function called to find a single resource.
   * @param {Model~findOneAndUpdate} [config.store.findOneAndUpdate] A function called to update a single resource.
   * @param {Model~findOneAndDelete} [config.store.findOneAndDelete] A function called to delete a single resource.
   * @param {string} [config.route] The route to use for requests of this type of resource. Defaults to pluralizing
   * the `name` property and then converting it to kebab-case.
   * @param {Model~serialize} [config.serialize] A function called to reformat the request body automatically before
   * passing it into the `create` and `findOneAndUpdate` store methods. It must be able to handle partial data objects.
   * @param {Model~unserialize} [config.unserialize] A function called to reformat the store method's return value
   * automatically before passing it into `postStore` policies and subsequently to the HTTP response.
   * @param {object} [config.initialMeta] The initial value of the `meta` object that is passed to the policies and
   * store methods.
   */
  constructor(config) {
    this._config = Model._normalizeConfig(config)
    this._hooks = null
    this._initialization = null
  }

  /**
   * Gets the normalized config.
   * @returns {object} The normalized config.
   */
  getConfig() {
    return this._config
  }

  /**
   * Gets the model name.
   * @returns {string} The model name.
   */
  getName() {
    return this.getConfig().name
  }

  /**
   * Gets the model route.
   * @returns {string} The model route.
   */
  getRoute() {
    return this.getConfig().route
  }

  /**
   * Gets the initial meta.
   * @returns {object} The initial meta.
   */
  getInitialMeta() {
    return this.getConfig().initialMeta
  }

  /**
   * Gets the policies.
   * @returns {object} The policies.
   */
  getPolicies() {
    return this.getConfig().policies
  }

  /**
   * Initializes the model if it hasn't been already.
   * @returns {Promise.<*>} The result of the initialization.
   */
  async init() {
    if (!this._initialization) {
      this._initialization = this.getConfig().init()
    }
    return this._initialization
  }

  /**
   * Creates a new resource.
   * @param {object} data The properties of the resource to create.
   * @param {object} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<object>} The new resource data.
   */
  async create(data, meta = {}, hookArgs) {
    const serializedData = await this.serialize(data)

    const runner = this._callWithHooks('create', data, hookArgs)
    await runner.next()

    const result = await this.getConfig().store.create(serializedData, meta)
    await runner.next(result)

    return this.unserialize(result)
  }

  /**
   * Finds resources.
   * @param {object} [query] The query to filter by.
   * @param {object} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<object[]>} The data of the found resources.
   */
  async find(query, meta = {}, hookArgs) {
    const runner = this._callWithHooks(null, hookArgs)
    await runner.next()

    const results = await this.getConfig().store.find('find', query, meta)
    await runner.next(results)

    return Promise.all(results.map(async result => this.unserialize(result)))
  }

  /**
   * Finds a resource.
   * @param {string} id The id of the resource to find.
   * @param {object} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<object>} The found resource data.
   */
  async findOne(id, meta = {}, hookArgs) {
    const runner = this._callWithHooks('findOne', null, hookArgs)
    await runner.next()

    const result = await this.getConfig().store.findOne(id, meta)
    await runner.next(result)

    return this.unserialize(result)
  }

  /**
   * Updates a resource.
   * @param {string} id The id of the resource to update.
   * @param {object} data The properties to update.
   * @param {object} [_completeData] The complete resource with the properties to update merged in. If omitted, it
   * will be fetched.
   * @param {object} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<object>} The updated resource data.
   */
  async findOneAndUpdate(id, data, _completeData = null, meta = {}, hookArgs) {
    const completeData = _completeData || (await this.getConfig().store.findOne(id))

    const [serializedData, serializedCompleteData] = await Promise.all([
      this.serialize(data),
      this.serialize(completeData),
    ])

    const runner = this._callWithHooks('findOneAndUpdate', completeData, hookArgs)
    await runner.next()

    const result = await this.getConfig().store.findOneAndUpdate(id, serializedData, serializedCompleteData, meta)
    await runner.next(result)

    return this.unserialize(result)
  }

  /**
   * Deletes a resource.
   * @param {string} id The id of the resource to delete.
   * @param {object} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<object>} An object containing an `id` property set to the deleted resource's id.
   */
  async findOneAndDelete(id, meta = {}, hookArgs) {
    const runner = this._callWithHooks('findOneAndDelete', null, hookArgs)
    await runner.next()

    await this.getConfig().store.findOneAndDelete(id, meta)
    const result = { id }
    await runner.next(result)

    return this.unserialize(result)
  }

  /**
   * Serializes the data for a store method.
   * @param {object} data The data to serialize.
   * @returns {Promise.<object>} The serialized data.
   */
  async serialize(data) {
    return this.getConfig().serialize(data)
  }

  /**
   * Unserializes the data from a store method.
   * @param {object} data The data to unserialize.
   * @returns {Promise.<object>} The unserialized data.
   */
  async unserialize(data) {
    return this.getConfig().unserialize(data)
  }

  /**
   * Validates the data against the schema.
   * @param {object} data The data to validate.
   * @returns {Promise.<void>} Resolves with undefined.
   */
  async validateAgainstSchema(data) {
    return this.getConfig().validateAgainstSchema(data)
  }

  /**
   * *Used internally.* Creates a copy of the model instance with the given lifecycle hooks added to it.
   * @param {object} hooks A set of lifecycle hooks.
   * @returns {Model} A copy of the model instance with the given hooks installed.
   */
  withHooks(hooks) {
    return cloneInstance(this, { _hooks: hooks })
  }

  async *_callWithHooks(method, data, hookArgs) {
    try {
      await this.init()
      await this._callHook(method, 'preSchema', hookArgs)
      if (data) {
        await this.validateAgainstSchema(data)
      }
      await this._callHook(method, 'postSchema', hookArgs)

      const result = yield

      await this._callHook(method, 'postStore', [...hookArgs, result])
    } catch (err) {
      throw AutonymError.fromError(err)
    }
  }

  async _callHook(method, hook, hookArgs) {
    if (this._hooks) {
      await this._hooks[method][hook](...hookArgs)
    }
  }
}

/**
 * @callback Model~init
 * @returns {Promise.<*>|*} A promise if asynchronous.
 */

/**
 * An object whose keys are store method names and whose values are asynchronous boolean expressions.
 * @typedef {object} PolicyLifecycleHook
 * @property {PolicyExpression} [create] The expression to run when the `create` method is called.
 * @property {PolicyExpression} [find] The expression to run when the `find` method is called.
 * @property {PolicyExpression} [findOne] The expression to run when the `findOne` method is called.
 * @property {PolicyExpression} [findOneAndUpdate] The expression to run when the `findOneAndUpdate` method is called.
 * @property {PolicyExpression} [findOneAndDelete] The expression to run when the `findOneAndUpdate` method is called.
 */

/**
 * An expression may be a boolean to explicitly allow or deny the method, a policy function that is evaluated and
 * may deny the method by throwing or rejecting with an error, or an object with a property `and` or `or` whose
 * value is an array of these types.
 * @typedef {Operand} PolicyExpression
 */

/**
 * @typedef {boolean|Policy|AndExpression|OrExpression} Operand
 */

/**
 * @typedef {object} AndExpression
 * @property {Operand[]} and
 */

/**
 * @typedef {object} OrExpression
 * @property {Operand[]} or
 */

/**
 * A function that may aggregate the request and/or prevent the request by throwing an exception.
 * @callback Policy
 * @param {AutonymReq} req The request object.
 * @param {AutonymRes} res The response object.
 * @param {object} meta The meta object aggregated by policies during the request.
 * @returns {Promise.<*>|*} The return value is ignored.
 */

/**
 * @callback Model~create
 * @param {object} data The serialized data to save.
 * @param {object} meta The meta object aggregated by policies during the request.
 * @returns {Promise.<object>|object} The saved record's data, including the `id` property.
 */

/**
 * @callback Model~find
 * @param {object} query The URL query string converted to an object.
 * @param {object} meta The meta object aggregated by policies during the request.
 * @returns {Promise.<object[]>|object[]} The data of the records that match the query.
 */

/**
 * @callback Model~findOne
 * @param {string} id The id of the resource to find.
 * @param {object} meta The meta object aggregated by policies during the request.
 * @returns {Promise.<object>|object} The data of the record with the given id.
 */

/**
 * @callback Model~findOneAndUpdate
 * @param {string} id The id of the resource to update.
 * @param {object} data The serialized data to save.
 * @param {object} completeData The serialized data merged with the existing properties of the resource.
 * @param {object} meta The meta object aggregated by policies during the request.
 * @returns {Promise.<object>|object} The saved record's data, including all unchanged properties.
 */

/**
 * @callback Model~findOneAndDelete
 * @param {string} id The id of the resource to delete.
 * @param {object} meta The meta object aggregated by policies during the request.
 * @returns {Promise.<*>|*} The return value is ignored.
 */

/**
 * @callback Model~serialize
 * @param {object} data The data to serialize. It may be a complete or partial resource.
 * @returns {Promise.<object>|object} The serialized resource.
 */

/**
 * @callback Model~unserialize
 * @param {object} data The data to unserialize.
 * @returns {Promise.<object>|object} The unserialized resource.
 */
