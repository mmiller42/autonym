'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _ajv = require('ajv');

var _ajv2 = _interopRequireDefault(_ajv);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _maybePromiseFactory = require('maybe-promise-factory');

var _maybePromiseFactory2 = _interopRequireDefault(_maybePromiseFactory);

var _asyncBooleanExpressionEvaluator = require('async-boolean-expression-evaluator');

var _asyncBooleanExpressionEvaluator2 = _interopRequireDefault(_asyncBooleanExpressionEvaluator);

var _autonymClientErrors = require('autonym-client-errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const STORE_CRUD_METHODS = ['find', 'findOne', 'create', 'findOneAndUpdate', 'findOneAndDelete', 'serialize', 'unserialize'];

const ajv = new _ajv2.default({
	allErrors: true,
	format: 'full',
	removeAdditional: 'all',
	useDefaults: true
});
const maybePromise = (0, _maybePromiseFactory2.default)();

class Model {
	static init(schema, policies) {
		if (schema) {
			this.schema = schema;
			this.policies = policies;

			const validate = ajv.compile(schema);
			this.validateAgainstSchema = data => {
				const result = validate(data);
				return result ? Promise.resolve(data) : Promise.reject(new _autonymClientErrors.InvalidPayloadError(validate.errors));
			};
		} else {
			process.emitWarning(`Missing schema for "${this.name}" model. No schema or policy validation will be used.`);
			this.validateAgainstSchema = data => Promise.resolve();
		}

		return this._init ? maybePromise(() => this._init()) : Promise.resolve();
	}

	static validate(req) {
		return this.doSchemaValidation(req).then(() => this.doPolicyValidation(req));
	}

	static doSchemaValidation(req) {
		if (!req.hasBody) {
			return Promise.resolve();
		}

		return maybePromise(this._preValidateAgainstSchema ? () => this._preValidateAgainstSchema(req) : null).then(() => {
			req.data = _lodash2.default.clone(req.body);
		}).then(() => {
			if (req.updating) {
				req.attributesToUpdate = _lodash2.default.clone(req.data);
				// Merge the original resource with the new attributes (can't validate against schema without a complete
				// resource)
				return this.findOne(req.resourceId).then(resource => _lodash2.default.defaultsDeep(req.data, resource));
			}
		}).then(() => {
			return this.validateAgainstSchema(req.data);
		}).then(() => {
			if (req.updating) {
				req.completeResource = req.data;
				req.data = _lodash2.default.pick(req.attributesToUpdate, _lodash2.default.keys(req.data));
				delete req.attributesToUpdate;
			}
		}).then(() => {
			return maybePromise(this._postValidateAgainstSchema ? () => this._postValidateAgainstSchema(req) : null);
		});
	}

	static doPolicyValidation(req) {
		return maybePromise(this._preValidateAgainstPolicies ? () => this._preValidateAgainstPolicies(req) : null).then(() => {
			return this.evaluatePolicies(_lodash2.default.get(this.schema, ['policies', '*']), req);
		}).then(() => {
			return this.evaluatePolicies(_lodash2.default.get(this.schema, ['policies', req.crudMethod]), req);
		}).then(() => {
			return maybePromise(this._postValidateAgainstPolicies ? () => this._postValidateAgainstPolicies(req) : null);
		});
	}

	static create(body, filter, meta) {
		return this._create ? this._create(this.serialize(body), filter, meta).then(resource => this.unserialize(resource)) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`create is not implemented for the resource "${this.name}".`));
	}

	static find(query, filter, meta) {
		return this._find ? this._find(query, filter, meta).then(resources => resources.map(resource => this.unserialize(resource))) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`find is not implemented for the resource "${this.name}".`));
	}

	static findOne(resourceId, filter, meta) {
		return this._findOne ? this._findOne(resourceId, filter, meta).then(resource => this.unserialize(resource)) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`findOne is not implemented for the resource "${this.name}".`));
	}

	static findOneAndUpdate(resourceId, body, filter, completeResource, meta) {
		return this._findOneAndUpdate ? this._findOneAndUpdate(resourceId, this.serialize(body), filter, this.serialize(completeResource), meta).then(resource => this.unserialize(resource)) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`findOneAndUpdate is not implemented for the resource "${this.name}".`));
	}

	static findOneAndDelete(resourceId, filter, meta) {
		return this._findOneAndDelete ? this._findOneAndDelete(resourceId, filter, meta) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`findOneAndDelete is not implemented for the resource "${this.name}".`));
	}

	static serialize(attributes) {
		attributes = _lodash2.default.cloneDeep(attributes);
		if (this._serialize) {
			attributes = this._serialize(attributes);
		}
		return attributes;
	}

	static unserialize(attributes) {
		attributes = _lodash2.default.cloneDeep(attributes);
		if (this._unserialize) {
			attributes = this._unserialize(attributes);
		}
		return attributes;
	}

	static _implementDefaultStoreCrudMethods(store) {
		let methods = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : STORE_CRUD_METHODS;

		methods.forEach(storeMethod => {
			const modelMethod = `_${storeMethod}`;
			if (!this[modelMethod] && store[storeMethod]) {
				this[modelMethod] = function () {
					return store[storeMethod](...arguments);
				};
			}
		});
	}

	static evaluatePolicies(expression, req) {
		if (!expression) {
			return Promise.resolve();
		}

		let lastError;
		const evaluator = new _asyncBooleanExpressionEvaluator2.default(policyName => {
			const policy = this.policies[policyName];
			if (!policy) {
				throw new Error(`Unknown policy "${policyName}" for model "${this.name}".`);
			}

			return new Promise(resolve => {
				maybePromise(() => policy(req)).then(() => resolve(true)).catch(err => {
					// `err` may be undefined if this is the result of a `not` expression
					lastError = err;
					resolve(false);
				});
			});
		});

		return evaluator.execute(expression).then(result => {
			if (!result) {
				throw lastError || new _autonymClientErrors.ForbiddenError('You do not have permission to perform this action.');
			}
		});
	}
}

exports.default = Model;