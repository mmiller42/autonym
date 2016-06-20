'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _instanceOfName = require('instance-of-name');

var _instanceOfName2 = _interopRequireDefault(_instanceOfName);

var _httpStatusCodes = require('http-status-codes');

var _httpStatusCodes2 = _interopRequireDefault(_httpStatusCodes);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class ErrorRouter {
	constructor() {
		this.middleware = (err, req, res, next) => {
			if ((0, _instanceOfName2.default)(err, 'ClientError')) {
				res.status(err.status || _httpStatusCodes2.default.BAD_REQUEST);
				if ((0, _instanceOfName2.default)(err, 'InvalidPayloadError')) {
					err.details.message = _lodash2.default.groupBy(err.details.message, 'dataPath');
				}
				res.data = err.details;
			} else {
				res.status(err.status || _httpStatusCodes2.default.INTERNAL_SERVER_ERROR).data = { message: 'An internal server error occurred.' };
			}

			next(err);
		};
	}
}

exports.default = ErrorRouter;