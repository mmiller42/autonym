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

const ajv = new _ajv2.default({
	allErrors: true,
	format: 'full',
	removeAdditional: 'all',
	useDefaults: true
});
const maybePromise = (0, _maybePromiseFactory2.default)(Promise);

class Model {
	static init(schema) {
		if (schema) {
			const validate = ajv.compile(schema);
			this.validateAgainstSchema = data => {
				const result = validate(data);
				return result ? Promise.resolve(data) : Promise.reject(new _autonymClientErrors.InvalidPayloadError(validate.errors));
			};
		} else {
			this.validateAgainstSchema = data => Promise.resolve();
		}

		if (this._init) {
			this._init();
		}
	}

	static validate(req) {
		return maybePromise(this._preValidateAgainstSchema ? this._preValidateAgainstSchema.bind(this, req) : null).then(() => {
			if (req.hasBody) {
				const attributes = _lodash2.default.clone(req.body);
				const data = _lodash2.default.clone(attributes);

				let promise = Promise.resolve();
				if (req.updating) {
					promise = this.findOne(req.resourceId).then(resource => _lodash2.default.defaultsDeep(data, resource));
				}

				promise = promise.then(() => this.validateAgainstSchema(data));

				if (req.updating) {
					promise = promise.then(data => _lodash2.default.pick(attributes, _lodash2.default.keys(data)));
				}

				promise = promise.then(data => req.data = data);

				return promise;
			}
		}).then(() => {
			return maybePromise(this._postValidateAgainstSchema ? this._postValidateAgainstSchema.bind(this, req) : null);
		});
	}

	static find(query) {
		return this._find ? this._find(query).then(resources => resources.map(resource => this.unserialize(resource))) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`find is not implemented for the resource "${ this.name }".`));
	}

	static findOne(resourceId) {
		return this._findOne ? this._findOne(resourceId).then(resource => this.unserialize(resource)) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`findOne is not implemented for the resource "${ this.name }".`));
	}

	static create(body) {
		return this._create ? this._create(this.serialize(body)).then(resource => this.unserialize(resource)) : Promise.reject(new _autonymClientErrors.MethodNotAllowedError(`create is not implemented for the resource "${ this.name }".`));
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
}

exports.default = Model;