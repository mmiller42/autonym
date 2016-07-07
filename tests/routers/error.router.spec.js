import should from 'should';
import makeRes from '../_utilities/make-res';
import ErrorRouter from '../../lib/routers/error.router';
import {ClientError, InvalidPayloadError} from 'autonym-client-errors';

describe('ErrorRouter', () => {
	describe('#constructor', () => {
		const errorRouter = new ErrorRouter();
		
		it('defines an error middleware function on the instance', () => {
			errorRouter.middleware.should.be.a.Function();
			errorRouter.middleware.length.should.equal(4);
		});
		
		describe('when receiving a ClientError', () => {
			it('sets `status` on the response to the value of the `status` field on the error', done => {
				const err = new ClientError(403, 'You are not allowed');
				const res = makeRes({_status: 200}, () => {
					res._status.should.equal(403);
					done();
				});
				
				errorRouter.middleware(err, {}, res, res.end);
			});

			it('defaults the `status` on the response to 400 if not provided', done => {
				const err = new ClientError(null, 'You are not allowed');
				const res = makeRes({_status: 200}, () => {
					res._status.should.equal(400);
					done();
				});

				errorRouter.middleware(err, {}, res, res.end);
			});
			
			it('sets the `data` on the response to the `details` of the error', done => {
				const err = new ClientError(403, 'You are not allowed');
				const res = makeRes({_status: 200}, () => {
					res.data.should.eql({status: 403, message: 'You are not allowed'});
					done();
				});

				errorRouter.middleware(err, {}, res, res.end);
			});

			it('reformats InvalidPayloadErrors to group by the `dataPath`', done => {
				const err = new InvalidPayloadError([
					{dataPath: '', message: 'You are missing required field `name`'},
					{dataPath: '.address', message: 'Field `address` must be a string'},
					{dataPath: '.address', message: 'Field `address` must be at least 3 characters long'}
				]);
				const res = makeRes({_status: 200}, () => {
					res.data.should.eql({
						status: 400,
						message: {
							'': [{dataPath: '', message: 'You are missing required field `name`'}],
							'.address': [
								{dataPath: '.address', message: 'Field `address` must be a string'},
								{dataPath: '.address', message: 'Field `address` must be at least 3 characters long'}
							]
						}
					});
					done();
				});

				errorRouter.middleware(err, {}, res, res.end);
			});
		});
		
		describe('when receiving any other kind of error', () => {
			it('sends a generic 500 error', done => {
				const err = new Error('Something bad happened.');
				const res = makeRes({_status: 200}, () => {
					res._status.should.equal(500);
					res.data.should.eql({message: 'An internal server error occurred.'});
					done();
				});
				
				errorRouter.middleware(err, {}, res, res.end);
			});
		});
	});
});
