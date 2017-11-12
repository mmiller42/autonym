/* eslint-disable import/unambiguous */

/**
 * A plain object that is shared for the given request. It is passed to all policies that execute for the given
 * store method, which can read and mutate it freely, and passed into the given store method. The meta object can be
 * used to add non-serializable data that is useful in the store method, data that is tangentially related to the
 * request but does not belong in the body (such as information about the current user session), cached results of
 * policies that may be repeated in an expression, etc.
 * @typedef {object} Meta
 * @example
 * async function getCurrentUserPolicy(req, res, meta) {
 *   if (meta.user) {
 *     // We already have fetched the user (i.e. this policy has probably already been run in this request).
 *     return
 *   }
 *   const authHeader = req.getHeader('Authorization')
 *   if (!authHeader) {
 *     throw new AutonymError(AutonymError.UNAUTHORIZED, 'You must be logged in to perform this action.')
 *   }
 *
 *   const [, token] = authHeader.split('Bearer ')
 *   const data = await verify(token)
 *   // Save data on meta object, which will be accessible on subsequent policies and store methods.
 *   meta.user = await User.findOne(data.userId)
 * }
 *
 * function canCreatePostPolicy(req, res, meta) {
 *   // Access the user object saved in the previous policy. Note: this means this policy is tightly coupled to the
 *   // getCurrentUserPolicy and will throw an error if it is used in isolation, which would by default return a 500
 *   // error. We *could* `await getCurrentUserPolicy(req, res, meta)` here if we wanted to use this policy alone.
 *   if (!meta.user.privileges.includes('createPost')) {
 *     throw new AutonymError(AutonymError.FORBIDDEN, 'You must have the createPost privilege to perform this action.')
 *   }
 * }
 *
 * const Post = new Model({
 *   name: 'post',
 *   policies: {
 *     create: { and: [getCurrentUserPolicy, canCreatePostPolicy] },
 *   },
 *   store: {
 *     // Since the `getCurrentUserPolicy` was called before inserting, the `user` object is available in the store
 *     // methods. If calling the API programmatically, e.g. `Post.create()`, this data will need to be supplied
 *     // manually in the `create` method, since policies are not called when using the model instance directly.
 *     create: (data, meta) => Db.insert({ ...data, authorId: meta.user.id }),
 *   }
 * })
 */

/**
 * An object mapping store method names to policy hooks. The hooks will be run for the given method. If the value is
 * just `true`, it is assumed that all requests will be honored and no policies are necessary for any lifecycle event;
 * if just `false`, it is assumed no requests will be honored.
 * @typedef {object} ModelPolicies
 * @property {object|boolean} [create] Policies to run for the `create` method.
 * @property {Operand} [create.preSchema] An expression to evaluate before the data is validated against the schema.
 * @property {Operand} [create.postSchema] An expression to evaluate after the data is validated against the schema.
 * @property {Operand} [create.preStore] An expression to evaluate before the data is passed to the store method.
 * @property {Operand} [create.postStore] An expression to evaluate after the store method has completed.
 * @property {object|boolean} [find] Policies to run for the `find` method.
 * @property {Operand} [find.preStore] An expression to evaluate before the data is passed to the store method.
 * @property {Operand} [find.postStore] An expression to evaluate after the store method has completed.
 * @property {object|boolean} [findOne] Policies to run for the `findOne` method.
 * @property {Operand} [findOne.preStore] An expression to evaluate before the data is passed to the store method.
 * @property {Operand} [findOne.postStore] An expression to evaluate after the store method has completed.
 * @property {object|boolean} [findOneAndUpdate] Policies to run for the `findOneAndUpdate` method.
 * @property {Operand} [findOneAndUpdate.preSchema] An expression to evaluate before the data is validated against the
 * schema.
 * @property {Operand} [findOneAndUpdate.postSchema] An expression to evaluate after the data is validated against the
 * schema.
 * @property {Operand} [findOneAndUpdate.preStore] An expression to evaluate before the data is passed to the store
 * method.
 * @property {Operand} [findOneAndUpdate.postStore] An expression to evaluate after the store method has completed.
 * @property {object|boolean} [findOneAndDelete] Policies to run for the `findOneAndDelete` method.
 * @property {Operand} [findOneAndDelete.preStore] An expression to evaluate before the data is passed to the store
 * method.
 * @property {Operand} [findOneAndDelete.postStore] An expression to evaluate after the store method has completed.
 * @example
 * const Post = new Model({
 *   name: 'post',
 *   policies: {
 *     create: {
 *       // Users must be logged in and have the proper permission to create a post
 *       preSchema: { and: [getCurrentUserPolicy, canCreatePostPolicy] },
 *       // Once the post is validated, it is safe to read and manipulate the request data
 *       postSchema: trimPostBodyPolicy,
 *     },
 *     find: {
 *       // All requests to get all posts should include a header with the total count
 *       postStore: addTotalCountHeaderToResponsePolicy,
 *     },
 *     findOneAndUpdate: {
 *       // Users must be logged in and own the post that they are trying to update
 *       preSchema: { and: [getCurrentUserPolicy, userIsOwnerOfPostPolicy] },
 *       postSchema: trimPostBodyPolicy,
 *     },
 *     findOneAndDelete: {
 *       preStore: { and: [getCurrentUserPolicy, userIsOwnerOfPostPolicy] },
 *     },
 *   },
 *   store: {},
 * })
 */

/**
 * An operand is a boolean (to explicitly allow or deny) or a policy function, or an AndExpression, OrExpression, or
 * NotExpression, which can be used to assemble more complex policies out of a series of policy functions.
 * AndExpressions, OrExpressions, and NotExpressions may be nested recursively. For details, see the documentation
 * of [async-boolean-expression-evaluator](https://github.com/mmiller42/async-boolean-expression-evaluator).
 * @typedef {boolean|Policy|AndExpression|OrExpression|NotExpression} Operand
 */

/**
 * An object with the key `and` set to an array of Operands. The expression will only evaluate to true if none of
 * the operands are false or throw errors. The error of the first policy to throw will be used, and short-circuiting
 * will prevent further policies from executing when one throws.
 * @typedef {object} AndExpression
 * @property {Operand[]} and
 */

/**
 * An object with the key `or` set to an array of Operands. The expression will only evaluate to true if at least
 * one of the operands is true or does not throw an error. The error of the last policy that throws will be used,
 * and short-circuiting will prevent further policies from executing when one does not throw.
 * @typedef {object} OrExpression
 * @property {Operand[]} or
 */

/**
 * An object with the key `not` set to an Operand. The expression will only evaluate to true if the result of the
 * operand is false or throws an error (which will be swallowed). If the result is true or does not throw an error,
 * a generic error will be thrown, so implement a custom policy if you require a more specific error message.
 * @typedef {object} NotExpression
 * @property {Operand} not
 */

/**
 * A function that is evaluated before a store method. It may modify the request data, validate the data and throw an
 * error, or determine that the client may not perform this request and throw an error. Policies may be combined in
 * an expression and applied to various store methods in a model's configuration.
 * @typedef {function(req: AutonymReq, res: AutonymRes, meta: Meta): Promise.<*, Error>|*} Policy
 * @example
 * async function getCurrentUserPolicy(req, res, meta) {
 *   if (meta.user) {
 *     // We already have fetched the user (i.e. this policy has probably already been run in this request).
 *     return
 *   }
 *   const authHeader = req.getHeader('Authorization')
 *   if (!authHeader) {
 *     throw new AutonymError(AutonymError.UNAUTHORIZED, 'You must be logged in to perform this action.')
 *   }
 *
 *   const [, token] = authHeader.split('Bearer ')
 *   const data = await verify(token)
 *   // Save data on meta object, which will be accessible on subsequent policies and store methods.
 *   meta.user = await User.findOne(data.userId)
 * }
 * @example
 * function canCreatePostPolicy(req, res, meta) {
 *   // Access the user object saved in the previous policy. Note: this means this policy is tightly coupled to the
 *   // getCurrentUserPolicy and will throw an error if it is used in isolation, which would by default return a 500
 *   // error. We *could* `await getCurrentUserPolicy(req, res, meta)` here if we wanted to use this policy alone.
 *   if (!meta.user.privileges.includes('createPost')) {
 *     throw new AutonymError(AutonymError.FORBIDDEN, 'You must have the createPost privilege to perform this action.')
 *   }
 * }
 * @example
 * function userIsOwnerOfPostPolicy(req, res, meta) {
 *   if (req.getId() !== req.meta.user.id) {
 *     throw new AutonymError(AutonymError.FORBIDDEN, 'You are not the owner of this post.')
 *   }
 * }
 * @example
 * function trimPostBodyPolicy(req, res, meta) {
 *   // If this policy is in the postSchema hook, it is safe to get and set data.
 *   req.setData({ body: req.getData().body.trim() })
 * }
 * @example
 * Post.count = () => Db.selectCount('posts')
 *
 * async function addTotalCountHeaderToResponsePolicy(req, res, meta) {
 *   // If this policy is in the postStore hook, it is safe to get and modify the response data.
 *
 *   const model = req.getModel()
 *   if (model.count) {
 *     const totalCount = await req.getModel().count()
 *     res.setHeader('X-Total-Count', totalCount)
 *   }
 * }
 */

/**
 * An object that has methods for CRUD operations for a typical record. It does not matter if this is a plain
 * object or an instance of a Store class, as long as it has these members on it.
 * @typedef {object} Store
 * @property {function(data: SerializedRecord, meta: Meta, unserializedData: Record):
 * Promise.<SerializedRecord, Error>|SerializedRecord} [create] A function called to create a new record.
 * @property {function(query: object, meta: Meta): Promise.<SerializedRecord[], Error>|SerializedRecord[]} [find]
 * A function called to find records.
 * @property {function(id: string, meta: Meta): Promise.<SerializedRecord, Error>|SerializedRecord} [findOne] A
 * function called to find a single record.
 * @property {function(id: string, data: SerializedRecord, completeData: SerializedRecord, meta: Meta,
 * unserializedData: Record, unserializedCompleteData: Record): Promise.<SerializedRecord, Error>|SerializedRecord}
 * [findOneAndUpdate] A function called to update a single record.
 * @property {function(id: string, meta: Meta): Promise.<*, Error>|*} [findOneAndDelete] A function called to delete
 * a single record.
 * @param {function(data: Record): Promise.<SerializedRecord, Error>|SerializedRecord} [serialize] A function
 * called to reformat the request body automatically before passing it into the `create` and `findOneAndUpdate`
 * store methods. It must be able to handle partial data objects.
 * @param {function(data: SerializedRecord): Promise.<Record, Error>|Record} [unserialize] A function called to
 * reformat the store method's return value automatically before passing it into `postStore` policies and
 * subsequently to the response.
 * @example
 * const Post = new Model({
 *   name: 'post',
 *   store: {
 *     create: data => Db.insert('posts', data),
 *     find: () => Db.selectAll('posts'),
 *     findOne: id => Db.selectOne('posts', { id }),
 *     findOneAndUpdate: (id, data) => Db.updateWhere('posts', { id }, data),
 *     findOneAndDelete: id => Db.deleteWhere('posts', { id }),
 *
 *     // Column names are the same as properties on the data, but in snake-case
 *     serialize: data => mapKeys(data, property => snakeCase(property)),
 *     // Properties are the same as column names in the table, but in camel-case
 *     unserialize: data => mapKeys(data, columnName => camelCase(columnName)),
 *   },
 * })
 */

/**
 * An object that represents a record that may be operated on by a model. A record may be partial (e.g. if it is
 * the properties to update in a findOneAndUpdate request). If it is the result of a store method, it should at
 * least have an `id` property.
 * @typedef {object} Record
 */

/**
 * A Record that has been transformed by the serialize function as a matter of convenience. It is only used in the
 * store methods and is always unserialized back into a Record before being passed onto other code outside the
 * store methods.
 * @typedef {object} SerializedRecord
 */

/**
 * A JSON schema object. [Read more about JSON Schema](http://json-schema.org/)
 * @typedef {object} Schema
 */

/**
 * Options to pass to the JSON schema validator. [See options](https://github.com/epoberezkin/ajv#options)
 * @typedef {object} AjvOptions
 */
