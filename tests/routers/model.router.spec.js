import should from 'should';
import sinon from 'sinon';
import Model from '../../lib/model.abstract';
import ModelRouter from '../../lib/routers/model.router';
import {NotFoundError} from 'autonym-client-errors';

describe('ModelRouter', () => {
	describe('#constructor', () => {
		it('sets the `middleware` property on the instance to a router', () => {
			const modelRouter = new ModelRouter({});
			modelRouter.middleware.should.be.a.Function();
		});
	});
	
	describe('#models', () => {
		it('resets the `modelsByRoute` property whenever models are changed', () => {
			class TestA extends Model {}
			TestA.route = 'test-a';
			class TestB extends Model {}
			TestB.route = 'test-b';
			
			const modelRouter = new ModelRouter({TestA});
			modelRouter.models.TestB = TestB;
			
			modelRouter.models.should.eql({TestA, TestB});
			modelRouter.modelsByRoute.should.eql({'test-a': TestA, 'test-b': TestB});
		});
	});

	describe('#aggregateReq', () => {
		describe('aggregates the request object for', () => {
			it('POST requests', () => {
				return aggregateReq({params: {modelRoute: 'test-a'}, method: 'POST'}).then(req => {
					req.crudMethod.should.equal('create');
					should(req.resourceId).be.null();
					req.getting.should.be.false();
					req.finding.should.be.false();
					req.findingOne.should.be.false();
					req.creating.should.be.true();
					req.updating.should.be.false();
					req.deleting.should.be.false();
					req.hasBody.should.be.true();
					req.writing.should.be.true();
					req.reading.should.be.true();
					req.Model.should.equal(TestA);
					req.models.should.eql({TestA});
				});
			});
			
			it('GET requests without a resourceId', () => {
				return aggregateReq({params: {modelRoute: 'test-a'}, path: '', method: 'GET'}).then(req => {
					req.crudMethod.should.equal('find');
					should(req.resourceId).be.null();
					req.getting.should.be.true();
					req.finding.should.be.true();
					req.findingOne.should.be.false();
					req.creating.should.be.false();
					req.updating.should.be.false();
					req.deleting.should.be.false();
					req.hasBody.should.be.false();
					req.writing.should.be.false();
					req.reading.should.be.true();
					req.Model.should.equal(TestA);
					req.models.should.eql({TestA});
				});
			});

			it('GET requests with a resourceId', () => {
				return aggregateReq({params: {modelRoute: 'test-a'}, path: '/123', method: 'GET'}).then(req => {
					req.crudMethod.should.equal('findOne');
					req.resourceId.should.equal('123');
					req.getting.should.be.true();
					req.finding.should.be.false();
					req.findingOne.should.be.true();
					req.creating.should.be.false();
					req.updating.should.be.false();
					req.deleting.should.be.false();
					req.hasBody.should.be.false();
					req.writing.should.be.false();
					req.reading.should.be.true();
					req.Model.should.equal(TestA);
					req.models.should.eql({TestA});
				});
			});

			['PUT', 'PATCH'].forEach(method => {
				it(`${method} requests with a resourceId`, () => {
					return aggregateReq({params: {modelRoute: 'test-a'}, path: '/123', method}).then(req => {
						req.crudMethod.should.equal('findOneAndUpdate');
						req.resourceId.should.equal('123');
						req.getting.should.be.false();
						req.finding.should.be.false();
						req.findingOne.should.be.true();
						req.creating.should.be.false();
						req.updating.should.be.true();
						req.deleting.should.be.false();
						req.hasBody.should.be.true();
						req.writing.should.be.true();
						req.reading.should.be.true();
						req.Model.should.equal(TestA);
						req.models.should.eql({TestA});
					});
				});
			});
			
			it('DELETE requests with a resourceId', () => {
				return aggregateReq({params: {modelRoute: 'test-a'}, path: '/123', method: 'DELETE'}).then(req => {
					req.crudMethod.should.equal('findOneAndDelete');
					req.resourceId.should.equal('123');
					req.getting.should.be.false();
					req.finding.should.be.false();
					req.findingOne.should.be.true();
					req.creating.should.be.false();
					req.updating.should.be.false();
					req.deleting.should.be.true();
					req.hasBody.should.be.false();
					req.writing.should.be.true();
					req.reading.should.be.false();
					req.Model.should.equal(TestA);
					req.models.should.eql({TestA});
				});
			});
		});

		it('throws a NotFoundError if the model does not exist', () => {
			class TestA extends Model {}
			TestA.route = 'test-a';
			class TestB extends Model {}
			TestB.route = 'test-b';

			const modelRouter = new ModelRouter({TestA});
			modelRouter.models.TestB = TestB;

			return Promise.all([
				aggregateReq(modelRouter, {params: {modelRoute: 'test-a'}, method: 'POST'}),
				aggregateReq(modelRouter, {params: {modelRoute: 'test-b'}, method: 'POST'}),
				new Promise((resolve, reject) => {
					aggregateReq(modelRouter, {params: {modelRoute: 'test-c'}, method: 'POST'})
						.then(() => reject(new Error('Should not have resolved')))
						.catch(err => {
							err.should.be.an.instanceof(NotFoundError);
							resolve();
						})
						.catch(err => reject(err));
				})
			]);
		});

		class TestA extends Model {}
		TestA.route = 'test-a';
		function aggregateReq () {
			let modelRouter;
			let req;
			if (arguments.length === 2) {
				([modelRouter, req] = arguments);
			} else {
				modelRouter = new ModelRouter({TestA});
				([req] = arguments);
			}
			return new Promise((resolve, reject) => {
				modelRouter.aggregateReq(req, {}, err => err ? reject(err) : resolve(req));
			});
		}
	});
});
