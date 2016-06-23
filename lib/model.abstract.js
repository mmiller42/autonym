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
	static init(schema) {
		if (schema) {
			const validate = ajv.compile(schema);
			this.validateAgainstSchema = data => {
				const result = validate(data);
				return result ? Promise.resolve(data) : Promise.reject(new _autonymClientErrors.InvalidPayloadError(validate.errors));
			};
		} else {
			process.emitWarning(`Missing schema for "${ this.name }" model. No schema or policy validation will be used.`);
			this.validateAgainstSchema = data => Promise.resolve();
		}

		return this._init ? maybePromise(() => this._init()) : Promise.resolve();
	}

	static validate(req) {
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

	static create(body) {
		return this._create ? this._create(this.serialize(body)).then(resource => this.unserialize(resource)) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`create is not implemented for the resource "${ this.name }".`));
	}

	static find(query) {
		return this._find ? this._find(query).then(resources => resources.map(resource => this.unserialize(resource))) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`find is not implemented for the resource "${ this.name }".`));
	}

	static findOne(resourceId) {
		return this._findOne ? this._findOne(resourceId).then(resource => this.unserialize(resource)) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`findOne is not implemented for the resource "${ this.name }".`));
	}

	static findOneAndUpdate(resourceId, body) {
		return this._findOneAndUpdate ? this._findOneAndUpdate(resourceId, this.serialize(body)).then(resource => this.unserialize(resource)) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`findOneAndUpdate is not implemented for the resource "${ this.name }".`));
	}

	static findOneAndDelete(resourceId) {
		return this._findOneAndDelete ? this._findOneAndDelete(resourceId) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`findOneAndDelete is not implemented for the resource "${ this.name }".`));
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
		let methods = arguments.length <= 1 || arguments[1] === undefined ? STORE_CRUD_METHODS : arguments[1];

		methods.forEach(storeMethod => {
			const modelMethod = `_${ storeMethod }`;
			if (!this[modelMethod] && store[storeMethod]) {
				this[modelMethod] = function () {
					return store[storeMethod](...arguments);
				};
			}
		});
	}
}

exports.default = Model;