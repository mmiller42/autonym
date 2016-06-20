'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _express = require('express');

var _layer = require('express/lib/router/layer');

var _layer2 = _interopRequireDefault(_layer);

var _maybePromiseFactory = require('maybe-promise-factory');

var _maybePromiseFactory2 = _interopRequireDefault(_maybePromiseFactory);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _httpStatusCodes = require('http-status-codes');

var _httpStatusCodes2 = _interopRequireDefault(_httpStatusCodes);

var _autonymClientErrors = require('autonym-client-errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const maybePromise = (0, _maybePromiseFactory2.default)(Promise);

class ModelRouter {
	constructor(models) {
		this.middleware = (0, _express.Router)();

		this.models = models;
		this.modelsByPlural = _lodash2.default.keyBy(_lodash2.default.values(models), 'plural');

		this.attachMiddleware();
	}

	attachMiddleware() {
		const router = (0, _express.Router)({ mergeParams: true });

		router.use((req, res, next) => {
			req.models = this.models;

			req.creating = req.method === 'POST';
			req.updating = req.method === 'PATCH';
			req.deleting = req.method === 'DELETE';
			req.hasBody = req.creating || req.updating;
			req.writing = req.hasBody || req.deleting;
			let layer = new _layer2.default('/:resourceId', null, _lodash2.default.noop);
			if (layer.match(req.path)) {
				req.resourceId = layer.params.resourceId || null;
			}

			const Model = this.modelsByPlural[req.params.pluralModel];
			if (Model) {
				req.Model = Model;
				next();
			} else {
				next(new _autonymClientErrors.NotFoundError(`Unrecognized model "${ req.params.pluralModel }".`));
			}
		});

		router.use((req, res, next) => {
			maybePromise(() => req.Model.validate(req)).then(() => next()).catch(err => next(err));
		});

		this.attachCrudRoutes(router);
		this.middleware.use('/:pluralModel', router);
	}

	attachCrudRoutes(router) {
		router.get('/', (req, res, next) => this.find(req, res, next));
		router.post('/', (req, res, next) => this.create(req, res, next));
		router.get('/:resourceId', (req, res, next) => this.findOne(req, res, next));
		router.patch('/:resourceId', (req, res, next) => this.findOneAndUpdate(req, res, next));
		router.delete('/:resourceId', (req, res, next) => this.findOneAndDelete(req, res, next));
	}

	find(req, res, next) {
		req.Model.find(req.query).then(results => {
			res.status(_httpStatusCodes2.default.OK).data = results;
			next();
		}).catch(err => next(err));
	}

	create(req, res, next) {
		req.Model.create(req.data).then(result => {
			res.status(_httpStatusCodes2.default.CREATED).set('Location', `${ req.originalUrl }/${ result.id }`).data = result;
			next();
		}).catch(err => next(err));
	}

	findOne(req, res, next) {
		req.Model.findOne(req.resourceId).then(result => {
			res.status(_httpStatusCodes2.default.OK).data = result;
			next();
		}).catch(err => next(err));
	}

	findOneAndUpdate(req, res, next) {
		req.Model.findOneAndUpdate(req.resourceId, req.data).then(result => {
			res.status(_httpStatusCodes2.default.OK).data = result;
			next();
		}).catch(err => next(err));
	}

	findOneAndDelete(req, res, next) {
		req.Model.findOneAndDelete(req.resourceId).then(() => {
			res.status(_httpStatusCodes2.default.NO_CONTENT).data = null;
			next();
		}).catch(err => next(err));
	}
}

exports.default = ModelRouter;