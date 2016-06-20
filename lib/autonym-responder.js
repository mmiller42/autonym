'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class AutonymResponder {
	constructor(handleError) {
		this.handleError = handleError;

		this.middleware = [(req, res, next) => this._sendResponse(null, res, next), (err, req, res, next) => this._sendResponse(err, res, next), (err, req, res, next) => {
			// This handler is only called if either handleError itself threw an exception,
			// or if there is no handleError function. Delay throwing the exception so that
			// the default Express error handler doesn't swallow it
			if (this.handleError) {
				setImmediate(() => {
					throw err;
				});
			} else {
				next(err);
			}
		}];
	}

	_sendResponse(err, res, next) {
		if (res.data !== undefined && res.data !== null) {
			res.json(res.data);
		} else {
			res.end();
		}

		if (err) {
			this.handleError ? this.handleError(err) : next(err);
		}
	}
}

exports.default = AutonymResponder;