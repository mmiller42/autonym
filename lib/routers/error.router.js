import instanceOf from 'instance-of-name';
import HTTP from 'http-status-codes';
import _ from 'lodash';

class ErrorRouter {
	constructor () {
		this.middleware = (err, req, res, next) => {
			if (instanceOf(err, 'ClientError')) {
				res.status(err.status || HTTP.BAD_REQUEST);
				let message = err.details.message;
				if (instanceOf(err, 'InvalidPayload')) {
					message = _.groupBy(message, 'dataPath');
				}
				res.data = {...err.details, message};
			} else {
				res.status(err.status || HTTP.INTERNAL_SERVER_ERROR).data = {message: 'An internal server error occurred.'};
			}
			
			next(err);
		};
		this.middleware.__autonym__ = 'ErrorRouter'; // Used to identify the router in tests
	}
}

export default ErrorRouter;
