import should from 'should';
import sinon from 'sinon';
import makeRes from './_utilities/make-res';
import AutonymResponder from '../lib/autonym-responder';

describe('AutonymResponder', () => {
	describe('#constructor', () => {
		describe('when passed no error handler', () => {
			runConstructorTests(() => new AutonymResponder());
		});

		function handleError (err) {}
		describe('when passed an error handler', () => {
			runConstructorTests(() => new AutonymResponder(handleError));
		});

		function runConstructorTests (instantiateAutonymResponder) {
			const autonymResponder = instantiateAutonymResponder();

			it('assigns an array of functions called `middleware` to the instance', () => {
				autonymResponder.middleware.should.be.an.Array();
				autonymResponder.middleware.should.matchEvery(e => typeof e === 'function');
			});

			const successMiddlewares = [];
			const errorMiddlewares = [];

			autonymResponder.middleware.forEach(middleware => {
				if (middleware.length === 4) {
					errorMiddlewares.push(middleware);
				} else {
					successMiddlewares.push(middleware);
				}
			});

			describe('when the request was successful', () => {
				runRequestTests(null);
			});
			
			describe('when an error occurred', () => {
				runRequestTests(new Error('Something went wrong'));
			});
			
			function runRequestTests (err) {
				let nextCondition = 'without invoking `next`';
				let next = () => { throw new Error('`next` was called'); };
				if (err && !autonymResponder.handleError) {
					nextCondition = 'and invokes `next`';
					next = () => {};
				}
				
				it('does nothing with the response if the client has already sent the response', () => {
					const res = makeRes({headersSent: true, _status: 200, data: 'Hello world'}, () => {});

					simulateMiddlewares(err, {}, res, next);
				});

				it('passes the response to the client ' + nextCondition, done => {
					const res = makeRes({_status: 200, data: 'Hello world'}, () => {
						res._status.should.equal(200);
						res._json.should.equal('Hello world');
						done();
					});

					simulateMiddlewares(err, {}, res, next);
				});

				it('if there is no data, passes the empty response to the client ' + nextCondition, done => {
					const res = makeRes({_status: 200, data: null}, () => {
						res._status.should.equal(200);
						should(res._json).be.undefined();
						done();
					});

					simulateMiddlewares(err, {}, res, next);
				});

				it('passes a 404 response to the client if no routes were matched ' + nextCondition, done => {
					const res = makeRes({_status: 200}, () => {
						res._status.should.equal(404);
						done();
					});

					simulateMiddlewares(err, {}, res, next);
				});
				
				if (err && autonymResponder.handleError) {
					it('should call `handleError` with the error', done => {
						const spy = sinon.spy(autonymResponder, 'handleError');
						
						const res = makeRes({_status: 200}, () => {
							spy.callCount.should.equal(1);
							autonymResponder.handleError.restore();
							done();
						});

						simulateMiddlewares(err, {}, res, next);
					});
				}
			}

			function simulateMiddlewares (err, req, res, next) {
				const middlewares = err ? errorMiddlewares : successMiddlewares;
				middlewares.every(middleware => {
					err ? middleware(err, req, res, next) : middleware(req, res, next);
				});
			}
		}
	});
});
