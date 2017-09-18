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
  static _normalizeConfig(config) {
    if (!isPlainObject(config)) {
      throw new TypeError('config parameter must be a plain object.')
    }

    const { name } = config

    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('config.name parameter must be a non-empty string.')
    }
    if (config.init !== undefined && typeof config.init !== 'function') {
      throw new TypeError('config.init parameter must be a function or undefined.')
    }
    if (config.schema !== null && !isPlainObject(config.schema)) {
      throw new TypeError('config.schema parameter must be a JSON schema or explicitly null.')
    }
    if (config.schema && config.schema.type !== 'object') {
      throw new TypeError('config.schema.type parameter must be object.')
    }
    if (config.ajvOptions !== undefined && !isPlainObject(config.ajvOptions)) {
      throw new TypeError('config.ajvOptions parameter must be a plain object or undefined.')
    }
    if (config.policies !== undefined && !isPlainObject(config.policies)) {
      throw new TypeError('config.policies parameter must be a plain object or undefined.')
    }
    if (config.store === null || typeof config.store !== 'object') {
      throw new TypeError('config.store parameter must be an object.')
    }
    ;[
      'create',
      'find',
      'findOne',
      'findOneAndUpdate',
      'findOneAndDelete',
      'serialize',
      'unserialize',
    ].forEach(method => {
      if (config.store[method] !== undefined && typeof config.store[method] !== 'function') {
        throw new TypeError(`config.store.${method} must be a function or undefined.`)
      }
    })
    if (config.route !== undefined && (typeof config.route !== 'string' || config.route === 0)) {
      throw new TypeError('config.route parameter must be a non-empty string or undefined.')
    }
    if (config.initialMeta !== undefined && !isPlainObject(config.initialMeta)) {
      throw new TypeError('config.initialMeta parameter must be a plain object or undefined.')
    }

    checkForUnrecognizedProperties('config', config, [
      'name',
      'init',
      'schema',
      'ajvOptions',
      'policies',
      'store',
      'route',
    ])
    checkForUnrecognizedProperties('config.policies', config.policies, POLICY_LIFECYCLE_HOOKS)
    forEach(config.policies, (hooks, hook) =>
      checkForUnrecognizedProperties(`config.policies.${hook}`, hooks, STORE_METHODS)
    )

    const normalizedConfig = defaultsDeep({}, config, {
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
      store: {
        ...STORE_METHODS.reduce((methods, method) => {
          methods[method] = () => {
            throw new AutonymError(AutonymError.METHOD_NOT_ALLOWED, `${method} is not implemented for model "${name}".`)
          }
          return methods
        }, {}),
        serialize: cloneDeep,
        unserialize: cloneDeep,
      },
      route: pluralize(kebabCase(name)),
      initialMeta: {},
    })

    const { init } = normalizedConfig
    normalizedConfig.init = async () => init()

    if (normalizedConfig.schema) {
      const validateAgainstSchema = new Ajv(normalizedConfig.ajvOptions).compile(normalizedConfig.schema)
      normalizedConfig.validateAgainstSchema = async data => {
        const validatedData = cloneDeep(data)
        if (!validateAgainstSchema(validatedData)) {
          throw new AutonymError(AutonymError.NOT_ACCEPTABLE, `Schema validation for model "${name}" failed.`, {
            errors: validateAgainstSchema.ajvErrors,
          })
        }
        return validatedData
      }
    } else {
      normalizedConfig.validateAgainstSchema = async data => data
    }

    normalizedConfig.store = mapValues(normalizedConfig.store, method => async (...args) =>
      method.apply(normalizedConfig.store, args)
    )

    const { serialize, unserialize } = normalizedConfig.store
    normalizedConfig.store.serialize = async data => serialize(data)
    normalizedConfig.store.unserialize = async data => unserialize(data)

    return normalizedConfig
  }

  /**
   * @param {object} config Configuration.
   * @param {string} config.name A unique name for the model, like `'user'`.
   * @param {function(): *|Promise.<*, Error>} [config.init] A function to call when the model is first used.
   * @param {Schema|null} config.schema A JSON schema to validate data against before passing it to the store
   * methods, or explicitly `null` to disable schema validation.
   * @param {AjvOptions} [config.ajvOptions] Additional options to pass to the Ajv instance.
   * @param {ModelPolicies} [config.policies] Configuration policies.
   * @param {Store} config.store Configuration store.
   * @param {string} [config.route] The route to use for requests of this type of resource. Defaults to pluralizing
   * the `name` property and then converting it to kebab-case.
   * @param {Meta} [config.initialMeta] The initial value of the `meta` object that is passed to the policies and
   * store methods.
   * @example
   * const Post = new Model({
   *   name: 'post',
   *   init: Db.connect(),
   *   schema: {
   *     type: 'object',
   *     properties: {
   *       title: { type: 'string' },
   *       body: { type: 'string' },
   *     },
   *     require: ['title', 'body'],
   *   },
   *   policies: {
   *     preSchema: {
   *       create: { and: [getCurrentUserPolicy, canCreatePostPolicy] },
   *       find: true,
   *       findOne: true,
   *       findOneAndUpdate: { and: [getCurrentUserPolicy, userIsOwnerOfPostPolicy] },
   *       findOneAndDelete: { and: [getCurrentUserPolicy, userIsOwnerOfPostPolicy] },
   *     },
   *     postSchema: {
   *       create: trimPostBodyPolicy,
   *       findOneAndUpdate: trimPostBodyPolicy,
   *     },
   *     postStore: {
   *       // These hooks are commonly used to add data to the request.
   *       find: addTotalCountHeaderToResponsePolicy,
   *     },
   *   },
   *   store: {
   *     create: data => Db.insert('posts', data),
   *     find: () => Db.selectAll('posts'),
   *     findOne: id => Db.selectOne('posts', { id }),
   *     findOneAndUpdate: (id, data) => Db.updateWhere('posts', { id }, data),
   *     findOneAndDelete: id => Db.deleteWhere('posts', { id }),
   *     serialize: data => mapKeys(data, property => snakeCase(property)),
   *     unserialize: data => mapKeys(data, columnName => camelCase(columnName)),
   *   },
   * })
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
   * @returns {Meta} The initial meta.
   */
  getInitialMeta() {
    return this.getConfig().initialMeta
  }

  /**
   * Gets the policies.
   * @returns {ModelPolicies} The policies.
   */
  getPolicies() {
    return this.getConfig().policies
  }

  /**
   * Initializes the model if it hasn't been already.
   * @returns {Promise.<*, Error>} The result of the initialization.
   */
  async init() {
    if (!this._initialization) {
      this._initialization = this.getConfig().init()
    }
    return this._initialization
  }

  /**
   * Creates a new resource.
   * @param {Resource} data The properties of the resource to create.
   * @param {Meta} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<Resource, AutonymError>} The new resource data.
   * @example
   * const data = await Post.create({
   *   title: 'Hello World',
   *   body: 'This is my first post.',
   * })
   *
   * console.log(data) // { id: '1', title: 'Hello World', body: 'This is my first post.' }
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
   * @param {Meta} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<Resource[], AutonymError>} The data of the found resources.
   * @example
   * const data = await Post.find()
   *
   * console.log(data) // [{ id: '1', title: 'Hello World', body: 'This is my first post.' }]
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
   * @param {Meta} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<Resource, AutonymError>} The found resource data.
   * @example
   * const data = await Post.findOne('1')
   *
   * console.log(data) // { id: '1', title: 'Hello World', body: 'This is my first post.' }
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
   * @param {Resource} data The properties to update.
   * @param {Resource} [completeData] The complete resource with the properties to update merged in. If omitted, it
   * will be fetched.
   * @param {Meta} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<Resource, AutonymError>} The updated resource data.
   * @example
   * const data = await Post.findOneAndUpdate('1', { title: 'Test' })
   *
   * console.log(data) // { id: '1', title: 'Test', body: 'This is my first post.' }
   */
  async findOneAndUpdate(id, data, completeData = null, meta = {}, hookArgs) {
    const fetchedCompleteData = completeData || (await this.getConfig().store.findOne(id))

    const [serializedData, serializedCompleteData] = await Promise.all([
      this.serialize(data),
      this.serialize(fetchedCompleteData),
    ])

    const runner = this._callWithHooks('findOneAndUpdate', fetchedCompleteData, hookArgs)
    await runner.next()

    const result = await this.getConfig().store.findOneAndUpdate(id, serializedData, serializedCompleteData, meta)
    await runner.next(result)

    return this.unserialize(result)
  }

  /**
   * Deletes a resource.
   * @param {string} id The id of the resource to delete.
   * @param {Meta} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<object, AutonymError>} An object containing an `id` property set to the deleted resource's id.
   * @example
   * const data = await Post.findOneAndDelete('1')
   *
   * console.log(data) // { id: '1' }
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
   * @param {Resource} data The data to serialize.
   * @returns {Promise.<SerializedResource, AutonymError>} The serialized data.
   * @example
   * const data = await Post.serialize({ authorId: '42' })
   *
   * console.log(data) // { author_id: '42' }
   */
  async serialize(data) {
    return this.getConfig().store.serialize(data)
  }

  /**
   * Unserializes the data from a store method.
   * @param {SerializedResource} data The data to unserialize.
   * @returns {Promise.<Resource, AutonymError>} The unserialized data.
   * @example
   * const data = await Post.unserialize({ author_id: '42' })
   *
   * console.log(data) // { authorId: '42' }
   */
  async unserialize(data) {
    try {
      return this.getConfig().store.unserialize(data)
    } catch (err) {
      throw AutonymError.fromError(err)
    }
  }

  /**
   * Validates the data against the schema.
   * @param {Resource} data The data to validate. This must be a complete resource.
   * @returns {Promise.<Resource, AutonymError>} Resolves with the validated data, which has unrecognized properties
   * filtered out and default values added.
   * @example
   * const validatedData = await Post.validateAgainstSchema({ title: 'Hello World', xyz: 123 })
   *
   * console.log(validatedData) // { title: 'Hello World' }
   */
  async validateAgainstSchema(data) {
    try {
      return this.getConfig().validateAgainstSchema(data)
    } catch (err) {
      throw AutonymError.fromError(err)
    }
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

      let validatedData = null
      if (data) {
        validatedData = await this.validateAgainstSchema(data)
      }
      await this._callHook(method, 'postSchema', [...hookArgs, validatedData])

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
