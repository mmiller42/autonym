import { checkForUnrecognizedProperties, cloneInstance, filterToProperties } from './utils'
import { cloneDeep, defaultsDeep, forEach, isPlainObject, kebabCase, mapValues, noop, reduce } from 'lodash'
import Ajv from 'ajv'
import AutonymError from './AutonymError'
import { pluralize } from 'inflection'

const STORE_METHODS = ['create', 'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete']
const POLICY_LIFECYCLE_HOOKS = {
  create: ['preSchema', 'postSchema', 'preStore', 'postStore'],
  find: ['preStore', 'postStore'],
  findOne: ['preStore', 'postStore'],
  findOneAndUpdate: ['preSchema', 'postSchema', 'preStore', 'postStore'],
  findOneAndDelete: ['preStore', 'postStore'],
}

/**
 * Class that defines an entity type for a record accessible in your API.
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
    if (config.optionalUpdateProperties !== undefined && !Array.isArray(config.optionalUpdateProperties)) {
      throw new TypeError('config.optionalUpdateProperties must be an array or undefined.')
    }
    if (config.optionalUpdateProperties) {
      config.optionalUpdateProperties.forEach((optionalUpdateProperty, i) => {
        if (
          typeof optionalUpdateProperty !== 'string' &&
          (!Array.isArray(optionalUpdateProperty) || !optionalUpdateProperty.every(p => typeof p === 'string'))
        ) {
          throw new TypeError(`config.optionalUpdateProperties[${i}] must be a string or array of strings`)
        }
      })
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
      'optionalUpdateProperties',
      'ajvOptions',
      'policies',
      'store',
      'route',
    ])
    checkForUnrecognizedProperties('config.policies', config.policies, STORE_METHODS)
    forEach(config.policies, (hooks, method) => {
      if (typeof hooks === 'boolean') {
        config.policies[method] = { preSchema: hooks, preStore: hooks }
      } else if (isPlainObject(hooks)) {
        checkForUnrecognizedProperties(`config.policies.${method}`, hooks, POLICY_LIFECYCLE_HOOKS[method])
      } else {
        throw new TypeError(`config.policies.${method} must be a plain object or a boolean.`)
      }
    })

    const normalizedConfig = defaultsDeep({}, config, {
      init: noop,
      schema: null,
      optionalUpdateProperties: [],
      ajvOptions: {
        allErrors: true,
        format: 'full',
        removeAdditional: 'all',
        useDefaults: true,
        errorDataPath: 'property',
      },
      policies: reduce(
        POLICY_LIFECYCLE_HOOKS,
        (policies, hooks, method) => {
          policies[method] = hooks.reduce((methodHooks, hook) => {
            methodHooks[hook] = true
            return methodHooks
          }, {})
          return policies
        },
        {}
      ),
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

      let validateUpdateAgainstSchema = validateAgainstSchema
      if (normalizedConfig.optionalUpdateProperties.length > 0) {
        const filteredSchema = cloneDeep(normalizedConfig.schema)
        normalizedConfig.optionalUpdateProperties.forEach(property => {
          const dataPath = Array.isArray(property) ? property : [property]
          const propertyToRemove = dataPath[dataPath.length - 1]

          let object = filteredSchema
          dataPath.slice(0, -1).forEach(key => {
            if (!object.properties || !object.properties[key]) {
              throw new TypeError(`Cannot remove property ${dataPath.join('.')} as it does not exist on the schema.`)
            }
            object = object.properties[key]
          })

          object.required = object.required.filter(prop => prop !== propertyToRemove)
        })
        validateUpdateAgainstSchema = new Ajv(normalizedConfig.ajvOptions).compile(filteredSchema)
      }

      normalizedConfig.validateAgainstSchema = async (data, isUpdate = false) => {
        const validatedData = cloneDeep(data)
        const validateFn = isUpdate ? validateUpdateAgainstSchema : validateAgainstSchema
        if (!validateFn(validatedData)) {
          throw new AutonymError(AutonymError.UNPROCESSABLE_ENTITY, `Schema validation for model "${name}" failed.`, {
            errors: validateFn.errors,
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
   * @param {Array<string|string[]>} [config.optionalUpdateProperties] A list of properties that are normally required
   * in the schema but may be optional in a findOneAndUpdate request. This is rarely needed as request data is merged
   * with the existing record before schema validation occurs, but this can be helpful when properties are converted to
   * computed properties when saved (e.g. user records that have a passwordHash property and whose password is deleted).
   * @param {AjvOptions} [config.ajvOptions] Additional options to pass to the Ajv instance.
   * @param {ModelPolicies} [config.policies] Configuration policies.
   * @param {Store} config.store Configuration store.
   * @param {string} [config.route] The route to use for requests of this type of record. Defaults to pluralizing
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
   *     create: {
   *       preSchema: { and: [getCurrentUserPolicy, canCreatePostPolicy] },
   *       postSchema: trimPostBodyPolicy,
   *     },
   *     find: {
   *       postStore: addTotalCountHeaderToResponsePolicy,
   *     },
   *     findOneAndUpdate: {
   *       preSchema: { and: [getCurrentUserPolicy, userIsOwnerOfPostPolicy] },
   *       postSchema: trimPostBodyPolicy,
   *     },
   *     findOneAndDelete: {
   *       preStore: { and: [getCurrentUserPolicy, userIsOwnerOfPostPolicy] },
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
   * Creates a new record.
   * @param {Record} data The properties of the record to create.
   * @param {Meta} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<Record, AutonymError>} The new record data.
   * @example
   * const data = await Post.create({
   *   title: 'Hello World',
   *   body: 'This is my first post.',
   * })
   *
   * console.log(data) // { id: '1', title: 'Hello World', body: 'This is my first post.' }
   */
  async create(data, meta = {}, hookArgs) {
    if (!isPlainObject(data)) {
      throw new TypeError('data parameter must be a plain object.')
    }
    if (!isPlainObject(meta)) {
      throw new TypeError('meta parameter must be a plain object.')
    }

    return this._callWithHooks(
      'create',
      data,
      async transformedData => {
        const serializedData = await this.serialize(transformedData)
        const result = await this.getConfig().store.create(serializedData, meta)
        return this.unserialize(result)
      },
      hookArgs
    )
  }

  /**
   * Finds records.
   * @param {object} [query] The query to filter by.
   * @param {Meta} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<Record[], AutonymError>} The data of the found records.
   * @example
   * const data = await Post.find()
   *
   * console.log(data) // [{ id: '1', title: 'Hello World', body: 'This is my first post.' }]
   */
  async find(query, meta = {}, hookArgs) {
    if (!isPlainObject(meta)) {
      throw new TypeError('meta parameter must be a plain object.')
    }

    return this._callWithHooks(
      'find',
      null,
      async () => {
        const results = await this.getConfig().store.find(query, meta)
        return Promise.all(results.map(async result => this.unserialize(result)))
      },
      hookArgs
    )
  }

  /**
   * Finds a record.
   * @param {string} id The id of the record to find.
   * @param {Meta} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<Record, AutonymError>} The found record data.
   * @example
   * const data = await Post.findOne('1')
   *
   * console.log(data) // { id: '1', title: 'Hello World', body: 'This is my first post.' }
   */
  async findOne(id, meta = {}, hookArgs) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('id parameter must be a non-empty string.')
    }
    if (!isPlainObject(meta)) {
      throw new TypeError('meta parameter must be a plain object.')
    }

    return this._callWithHooks(
      'findOne',
      null,
      async () => {
        const result = await this.getConfig().store.findOne(id, meta)
        return this.unserialize(result)
      },
      hookArgs
    )
  }

  /**
   * Updates a record.
   * @param {string} id The id of the record to update.
   * @param {Record} data The properties to update.
   * @param {Record} [completeData] The complete record with the properties to update merged in. If omitted, it
   * will be fetched.
   * @param {Meta} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<Record, AutonymError>} The updated record data.
   * @example
   * const data = await Post.findOneAndUpdate('1', { title: 'Test' })
   *
   * console.log(data) // { id: '1', title: 'Test', body: 'This is my first post.' }
   */
  async findOneAndUpdate(id, data, completeData = null, meta = {}, hookArgs) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('id parameter must be a non-empty string.')
    }
    if (!isPlainObject(data)) {
      throw new TypeError('data parameter must be a plain object.')
    }
    if (completeData && !isPlainObject(completeData)) {
      throw new TypeError('completeData parameter must be a plain object or undefined.')
    }
    if (!isPlainObject(meta)) {
      throw new TypeError('meta parameter must be a plain object.')
    }

    const fetchedCompleteData = completeData || (await this.getConfig().store.findOne(id))

    return this._callWithHooks(
      'findOneAndUpdate',
      fetchedCompleteData,
      async transformedData => {
        const [serializedData, serializedCompleteData] = await Promise.all([
          this.serialize(filterToProperties(transformedData, data)),
          this.serialize(transformedData),
        ])

        const result = await this.getConfig().store.findOneAndUpdate(id, serializedData, serializedCompleteData, meta)
        return this.unserialize(result)
      },
      hookArgs
    )
  }

  /**
   * Deletes a record.
   * @param {string} id The id of the record to delete.
   * @param {Meta} [meta] Additional metadata to pass to the store.
   * @param {array} [hookArgs] *Used internally.* Arguments to pass into the hooks.
   * @returns {Promise.<object, AutonymError>} An object containing an `id` property set to the deleted record's id.
   * @example
   * const data = await Post.findOneAndDelete('1')
   *
   * console.log(data) // { id: '1' }
   */
  async findOneAndDelete(id, meta = {}, hookArgs) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('id parameter must be a non-empty string.')
    }
    if (!isPlainObject(meta)) {
      throw new TypeError('meta parameter must be a plain object.')
    }

    return this._callWithHooks(
      'findOneAndDelete',
      null,
      async () => {
        await this.getConfig().store.findOneAndDelete(id, meta)
        const result = { id }
        return this.unserialize(result)
      },
      hookArgs
    )
  }

  /**
   * Serializes the data for a store method.
   * @param {Record} data The data to serialize.
   * @returns {Promise.<SerializedRecord, AutonymError>} The serialized data.
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
   * @param {SerializedRecord} data The data to unserialize.
   * @returns {Promise.<Record, AutonymError>} The unserialized data.
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
   * @param {Record} data The data to validate. This must be a complete record.
   * @param {string} [method] One of 'create', 'find', 'findOne', 'findOneAndUpdate', or 'findOneAndDelete', which may
   * determine different schema restrictions based on the configuration.
   * @returns {Promise.<Record, AutonymError>} Resolves with the validated data, which has unrecognized properties
   * filtered out and default values added.
   * @example
   * const validatedData = await Post.validateAgainstSchema({ title: 'Hello World', xyz: 123 })
   *
   * console.log(validatedData) // { title: 'Hello World' }
   */
  async validateAgainstSchema(data, method = null) {
    return this.getConfig().validateAgainstSchema(data, method === 'findOneAndUpdate')
  }

  /**
   * *Used internally.* Creates a copy of the model instance with the given lifecycle hooks added to it.
   * @param {object} hooks A set of lifecycle hooks.
   * @returns {Model} A copy of the model instance with the given hooks installed.
   */
  withHooks(hooks) {
    return cloneInstance(this, { _hooks: hooks })
  }

  async _callWithHooks(method, data, fn, hookArgs = []) {
    try {
      await this.init()

      let transformedData = data
      if (data) {
        transformedData = await this._callHook(method, 'preSchema', hookArgs, transformedData)
        transformedData = await this.validateAgainstSchema(transformedData, method)
        transformedData = await this._callHook(method, 'postSchema', hookArgs, transformedData)
      }

      transformedData = await this._callHook(method, 'preStore', hookArgs, transformedData)
      transformedData = await fn(transformedData)
      transformedData = await this._callHook(method, 'postStore', hookArgs, transformedData)

      return transformedData
    } catch (err) {
      throw AutonymError.fromError(err)
    }
  }

  async _callHook(method, hook, hookArgs, data) {
    if (this._hooks) {
      return this._hooks[method][hook](...hookArgs, data)
    } else {
      return data
    }
  }
}
