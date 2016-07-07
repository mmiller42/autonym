import {Router} from 'express';
import Layer from 'express/lib/router/layer';
import maybePromiseFactory from 'maybe-promise-factory';
import _ from 'lodash';
import HTTP from 'http-status-codes';

import {NotFoundError} from 'autonym-client-errors';

const maybePromise = maybePromiseFactory(Promise);

class ModelRouter {
	constructor (models) {
		this.middleware = Router();
		this.middleware.__autonym__ = 'ModelRouter'; // Used to identify the router in tests

		this._models = {};
		this._modelsProxy = new Proxy(this._models, {
			set: (target, property, value) => {
				this._models[property] = value;
				this.modelsByRoute = _.keyBy(_.values(this._models), 'route');
				return true;
			}
		});
		Object.assign(this.models, models);

		this.attachMiddleware();
	}

	get models () {
		return this._modelsProxy;
	}

	attachMiddleware () {
		const router = Router({mergeParams: true});

		router.use((req, res, next) => this.aggregateReq(req, res, next));
		router.use((req, res, next) => this.validateReq(req, res, next));

		this.attachCrudRoutes(router);
		this.middleware.use('/:modelRoute', router);
	}
	
	aggregateReq (req, res, next) {
		req.filter = [];
		
		req.models = this.models;

		req.resourceId = null;
		let layer = new Layer('/:resourceId', null, _.noop);
		if (layer.match(req.path)) {
			req.resourceId = layer.params.resourceId || null;
		}
		req.getting = req.method === 'GET';
		req.finding = req.getting && !req.resourceId;
		req.findingOne = Boolean(req.resourceId);
		req.creating = req.method === 'POST';
		req.updating = req.method === 'PATCH' || req.method === 'PUT';
		req.deleting = req.method === 'DELETE';
		req.hasBody = req.creating || req.updating;
		req.writing = req.hasBody || req.deleting;
		req.reading = !req.deleting;

		switch (true) {
			case req.finding: req.crudMethod = 'find'; break;
			case req.findingOne && req.getting: req.crudMethod = 'findOne'; break;
			case req.creating: req.crudMethod = 'create'; break;
			case req.updating: req.crudMethod = 'findOneAndUpdate'; break;
			case req.deleting: req.crudMethod = 'findOneAndDelete'; break;
		}

		const Model = this.modelsByRoute[req.params.modelRoute];
		if (!Model) {
			return next(new NotFoundError(`Unrecognized model "${req.params.modelRoute}".`));
		}
		req.Model = Model;
		next();
	}
	
	validateReq (req, res, next) {
		maybePromise(() => req.Model.validate(req))
			.then(() => next())
			.catch(err => next(err));
	}

	attachCrudRoutes (router) {
		router.route('/')
			.get((req, res, next) => this.find(req, res, next))
			.post((req, res, next) => this.create(req, res, next));
		
		router.route('/:resourceId')
			.get((req, res, next) => this.findOne(req, res, next))
			.patch((req, res, next) => this.findOneAndUpdate(req, res, next))
			.put((req, res, next) => this.findOneAndUpdate(req, res, next))
			.delete((req, res, next) => this.findOneAndDelete(req, res, next));
	}

	find (req, res, next) {
		req.Model.find(req.query, req.filter)
			.then(results => {
				res.status(HTTP.OK).data = results;
				next();
			})
			.catch(err => next(err));
	}

	create (req, res, next) {
		req.Model.create(req.data)
			.then(result => {
				res.status(HTTP.CREATED).set('Location', `${req.originalUrl}/${result.id}`).data = result;
				next();
			})
			.catch(err => next(err));
	}

	findOne (req, res, next) {
		req.Model.findOne(req.resourceId, req.filter)
			.then(result => {
				res.status(HTTP.OK).data = result;
				next();
			})
			.catch(err => next(err));
	}

	findOneAndUpdate (req, res, next) {
		req.Model.findOneAndUpdate(req.resourceId, req.data, req.filter)
			.then(result => {
				res.status(HTTP.OK).data = result;
				next();
			})
			.catch(err => next(err));
	}

	findOneAndDelete (req, res, next) {
		req.Model.findOneAndDelete(req.resourceId, req.filter)
			.then(() => {
				res.status(HTTP.NO_CONTENT).data = null;
				next();
			})
			.catch(err => next(err));
	}
}

export default ModelRouter;
