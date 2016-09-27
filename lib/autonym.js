import {Router} from 'express';
import path from 'path';
import _ from 'lodash';
import inflection from 'inflection';

import requireAll from './utils/require-all';
import ModelRouter from './routers/model.router';
import ErrorRouter from './routers/error.router';

class Autonym {
	static loadFromPath (dirname) {
		return {
			models: requireAll({
				dirname: path.join(dirname, 'models'),
				filter: /^(.+)\.model\.js$/,
				recursive: false,
				map: name => _.upperFirst(_.camelCase(name)),
				resolve: ({default: Model}) => Model
			}),
			schemas: requireAll({
				dirname: path.join(dirname, 'schemas'),
				filter: /^(.+)\.schema\.json$/,
				recursive: false,
				map: name => _.upperFirst(_.camelCase(name))
			}),
			policies: requireAll({
				dirname: path.join(dirname, 'policies'),
				filter: /^(.+)\.policy\.js$/,
				recursive: false,
				map: name => _.camelCase(name),
				resolve: ({default: policy}) => policy
			})
		};
	}
	
	constructor (components, config = {}) {
		if (typeof components === 'string') {
			components = Autonym.loadFromPath(components);
		}

		let {models = {}, schemas = {}, policies = {}} = components;

		this._models = {};
		this._modelsProxy = new Proxy(this._models, {
			set: (target, property, value) => {
				this._models[property] = value;
				this.modelRouter.models[property] = value;
				return true;
			}
		});
		models = _.map(models, (Model, key) => {
			if (!Model.name) {
				Object.defineProperty(Model, 'name', {value: key, configurable: true});
			}
			return Model;
		});

		schemas = _.mapKeys(schemas, (schema, key) => {
			schema.id = schema.id || key;
			return schema.id;
		});
		this.schemas = schemas;
		
		policies = _.mapKeys(policies, (policy, key) => {
			if (!policy.name) {
				Object.defineProperty(policy, 'name', {value: key, configurable: true});
			}
			return policy.name;
		});
		this.policies = policies;
		
		this.modelsInitialized = Promise.all(models.map(Model => this._resolveModel(Model))).then(models => {
			Object.assign(this.models, _.keyBy(models, 'name'));
		});
		
		this.config = config;
		
		this.middleware = Router();
		
		this.modelRouter = new ModelRouter(this.models);
		this.errorRouter = new ErrorRouter();
		
		this.middleware.use(this.modelRouter.middleware);
		this.middleware.use(this.errorRouter.middleware);
	}
	
	get models () {
		return this._modelsProxy;
	}

	_resolveModel (Model) {
		return Model.init(this.schemas[Model.name], this.policies).then(() => {
			Model.route = Model.route || inflection.pluralize(_.kebabCase(Model.name));
			Model.models = this.models;
			return Model;
		});
	}
}

export default Autonym;
