'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

require('source-map-support/register');

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
				filter: /^(.*)\.model\.js$/,
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
				recursive: false
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


		schemas = _lodash2.default.mapKeys(schemas, (schema, key) => schema.id || key);
		this.schemas = schemas;

		models = _lodash2.default.mapKeys(models, (Model, key) => Model.name || key);
		models = _lodash2.default.mapValues(models, (Model, name) => this._resolveModel(Model, name));
		this.models = models;

		this.policies = policies;
		this.config = config;

		this.middleware = (0, _express.Router)();
		this.middleware.use(new _model2.default(models, schemas).middleware);
		this.middleware.use(new _error2.default().middleware);
	}

	_resolveModel(Model, name) {
		Model.init(this.schemas[name]);
		Model.singular = Model.singular || _lodash2.default.kebabCase(Model.name);
		Model.plural = Model.plural || _inflection2.default.pluralize(Model.singular);
		return Model;
	}
}

exports.default = Autonym;