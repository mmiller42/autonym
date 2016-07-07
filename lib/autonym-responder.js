import HTTP from 'http-status-codes';

class AutonymResponder {
	constructor (handleError) {
		this.handleError = handleError;
		
		this.middleware = [
			(req, res, next) => this._sendResponse(null, res, next),
			(err, req, res, next) => this._sendResponse(err, res, next)
		];
	}
	
	_sendResponse (err, res, next) {
		if (err) {
			(this.handleError || next)(err);
		}
		
		if (!res.headersSent) {
			if (res.data !== undefined && res.data !== null) {
				res.json(res.data);
			} else if (res.data === null) {
				res.end();
			} else {
				res.status(HTTP.NOT_FOUND).end();
			}
		}
	}
}

export default AutonymResponder;
