'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _express = require('express');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _requireAll = require('require-all');

var _requireAll2 = _interopRequireDefault(_requireAll);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _inflection = require('inflection');

var _inflection2 = _interopRequireDefault(_inflection);

var _model = require('./routers/model.router');

var _model2 = _interopRequireDefault(_model);

var _error = require('./routers/error.router');

var _error2 = _interopRequireDefault(_error);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Autonym {
	static loadFromPath(dirname) {
		return {
			models: (0, _requireAll2.default)({
				dirname: _path2.default.join(dirname, 'models'),
				filter: /^(.+)\.model\.js$/,
				recursive: false,
				map: name => _lodash2.default.upperFirst(_lodash2.default.camelCase(name)),
				resolve: _ref => {
					let Model = _ref.default;
					return Model;
				}
			}),
			schemas: (0, _requireAll2.default)({
				dirname: _path2.default.join(dirname, 'schemas'),
				filter: /^(.+)\.schema\.json$/,
				recursive: false,
				map: name => _lodash2.default.upperFirst(_lodash2.default.camelCase(name))
			}),
			policies: (0, _requireAll2.default)({
				dirname: _path2.default.join(dirname, 'policies'),
				filter: /^(.+)\.policy\.js$/,
				recursive: false,
				map: name => _lodash2.default.camelCase(name),
				resolve: _ref2 => {
					let policy = _ref2.default;
					return policy;
				}
			})
		};
	}

	constructor(components) {
		let config = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

		if (typeof components === 'string') {
			components = Autonym.loadFromPath(components);
		}

		var _components = components;
		var _components$models = _components.models;
		let models = _components$models === undefined ? {} : _components$models;
		var _components$schemas = _components.schemas;
		let schemas = _components$schemas === undefined ? {} : _components$schemas;
		var _components$policies = _components.policies;
		let policies = _components$policies === undefined ? {} : _components$policies;


		this._models = {};
		this._modelsProxy = new Proxy(this._models, {
			set: (target, property, value) => {
				this._models[property] = value;
				this.modelRouter.models[property] = value;
				return true;
			}
		});
		models = _lodash2.default.map(models, (Model, key) => {
			if (!Model.name) {
				Object.defineProperty(Model, 'name', { value: key, configurable: true });
			}
			return Model;
		});

		schemas = _lodash2.default.mapKeys(schemas, (schema, key) => {
			schema.id = schema.id || key;
			return schema.id;
		});
		this.schemas = schemas;

		policies = _lodash2.default.mapKeys(policies, (policy, key) => {
			if (!policy.name) {
				Object.defineProperty(policy, 'name', { value: key, configurable: true });
			}
			return policy.name;
		});
		this.policies = policies;

		this.modelsInitialized = Promise.all(models.map(Model => this._resolveModel(Model))).then(models => {
			Object.assign(this.models, _lodash2.default.keyBy(models, 'name'));
		});

		this.config = config;

		this.middleware = (0, _express.Router)();

		this.modelRouter = new _model2.default(this.models);
		this.errorRouter = new _error2.default();

		this.middleware.use(this.modelRouter.middleware);
		this.middleware.use(this.errorRouter.middleware);
	}

	get models() {
		return this._modelsProxy;
	}

	_resolveModel(Model) {
		return Model.init(this.schemas[Model.name], this.policies).then(() => {
			Model.route = Model.route || _inflection2.default.pluralize(_lodash2.default.kebabCase(Model.name));
			return Model;
		});
	}
}

exports.default = Autonym;