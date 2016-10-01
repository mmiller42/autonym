import Ajv from 'ajv';
import _ from 'lodash';
import maybePromiseFactory from 'maybe-promise-factory';
import AsyncBooleanExpressionEvaluator from 'async-boolean-expression-evaluator';

import {MethodNotAllowedError, InvalidPayloadError, ForbiddenError} from 'autonym-client-errors';

const STORE_CRUD_METHODS = ['find', 'findOne', 'create', 'findOneAndUpdate', 'findOneAndDelete', 'serialize',
	'unserialize'];

const ajv = new Ajv({
	allErrors: true,
	format: 'full',
	removeAdditional: 'all',
	useDefaults: true
});
const maybePromise = maybePromiseFactory();

class Model {
	static init (schema, policies) {
		if (schema) {
			this.schema = schema;
			this.policies = policies;
			
			const validate = ajv.compile(schema);
			this.validateAgainstSchema = data => {
				const result = validate(data);
				return result ? Promise.resolve(data) : Promise.reject(new InvalidPayloadError(validate.errors));
			};
		} else {
			process.emitWarning(`Missing schema for "${this.name}" model. No schema or policy validation will be used.`);
			this.validateAgainstSchema = data => Promise.resolve();
		}

		return this._init ? maybePromise(() => this._init()) : Promise.resolve();
	}

	static validate (req) {
		return this.doSchemaValidation(req).then(() => this.doPolicyValidation(req));
	}
	
	static doSchemaValidation (req) {
		if (!req.hasBody) { return Promise.resolve(); }
		
		return maybePromise(this._preValidateAgainstSchema ? () => this._preValidateAgainstSchema(req) : null)
			.then(() => {
				req.data = _.clone(req.body);
			})
			.then(() => {
				if (req.updating) {
					req.attributesToUpdate = _.clone(req.data);
					// Merge the original resource with the new attributes (can't validate against schema without a complete
					// resource)
					return this.findOne(req.resourceId).then(resource => _.defaultsDeep(req.data, resource));
				}
			})
			.then(() => {
				return this.validateAgainstSchema(req.data);
			})
			.then(() => {
				if (req.updating) {
					req.completeResource = req.data;
					req.data = _.pick(req.attributesToUpdate, _.keys(req.data));
					delete req.attributesToUpdate;
				}
			})
			.then(() => {
				return maybePromise(this._postValidateAgainstSchema ? () => this._postValidateAgainstSchema(req) : null);
			})
	}
	
	static doPolicyValidation (req) {
		return maybePromise(this._preValidateAgainstPolicies ? () => this._preValidateAgainstPolicies(req) : null)
			.then(() => {
				return this.evaluatePolicies(_.get(this.schema, ['policies', '*']), req);
			})
			.then(() => {
				return this.evaluatePolicies(_.get(this.schema, ['policies', req.crudMethod]), req);
			})
			.then(() => {
				return maybePromise(this._postValidateAgainstPolicies ? () => this._postValidateAgainstPolicies(req) : null);
			});
	}

	static create (body, filter) {
		return this._create
			? this._create(this.serialize(body), filter).then(resource => this.unserialize(resource))
			: Promise.reject(new MethodNotAllowedError(`create is not implemented for the resource "${this.name}".`));
	}

	static find (query, filter) {
		return this._find
			? this._find(query, filter).then(resources => resources.map(resource => this.unserialize(resource)))
			: Promise.reject(new MethodNotAllowedError(`find is not implemented for the resource "${this.name}".`));
	}

	static findOne (resourceId, filter) {
		return this._findOne
			? this._findOne(resourceId, filter).then(resource => this.unserialize(resource))
			: Promise.reject(new MethodNotAllowedError(`findOne is not implemented for the resource "${this.name}".`));
	}

	static findOneAndUpdate (resourceId, body, filter, completeResource) {
		return this._findOneAndUpdate
			? this._findOneAndUpdate(resourceId, this.serialize(body), filter, this.serialize(completeResource))
				.then(resource => this.unserialize(resource))
			: Promise.reject(new MethodNotAllowedError(`findOneAndUpdate is not implemented for the resource "${this.name}".`));
	}

	static findOneAndDelete (resourceId, filter) {
		return this._findOneAndDelete
			? this._findOneAndDelete(resourceId, filter)
			: Promise.reject(new MethodNotAllowedError(`findOneAndDelete is not implemented for the resource "${this.name}".`));
	}

	static serialize (attributes) {
		attributes = _.cloneDeep(attributes);
		if (this._serialize) {
			attributes = this._serialize(attributes);
		}
		return attributes;
	}

	static unserialize (attributes) {
		attributes = _.cloneDeep(attributes);
		if (this._unserialize) {
			attributes = this._unserialize(attributes);
		}
		return attributes;
	}

	static _implementDefaultStoreCrudMethods (store, methods = STORE_CRUD_METHODS) {
		methods.forEach(storeMethod => {
			const modelMethod = `_${storeMethod}`;
			if (!this[modelMethod] && store[storeMethod]) {
				this[modelMethod] = function () {
					return store[storeMethod](...arguments);
				};
			}
		});
	}
	
	static evaluatePolicies (expression, req) {
		if (!expression) { return Promise.resolve(); }

		let lastError;
		const evaluator = new AsyncBooleanExpressionEvaluator(policyName => {
			const policy = this.policies[policyName];
			if (!policy) { throw new Error(`Unknown policy "${policyName}" for model "${this.name}".`); }

			return new Promise(resolve => {
				maybePromise(() => policy(req))
					.then(() => resolve(true))
					.catch(err => {
						// `err` may be undefined if this is the result of a `not` expression
						lastError = err;
						resolve(false);
					});
			});
		});

		return evaluator.execute(expression).then(result => {
			if (!result) { throw lastError || new ForbiddenError('You do not have permission to perform this action.'); }
		});
	}
}

export default Model;
