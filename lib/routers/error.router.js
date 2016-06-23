'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

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
				let message = err.details.message;
				if ((0, _instanceOfName2.default)(err, 'InvalidPayload')) {
					message = _lodash2.default.groupBy(message, 'dataPath');
				}
				res.data = _extends({}, err.details, { message });
			} else {
				res.status(err.status || _httpStatusCodes2.default.INTERNAL_SERVER_ERROR).data = { message: 'An internal server error occurred.' };
			}

			next(err);
		};
		this.middleware.__autonym__ = 'ErrorRouter'; // Used to identify the router in tests
	}
}

exports.default = ErrorRouter;