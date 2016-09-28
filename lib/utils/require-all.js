'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _requireAll2 = require('require-all');

var _requireAll3 = _interopRequireDefault(_requireAll2);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function requireAll(options) {
	try {
		_fs2.default.accessSync(options.dirname, _fs2.default.constants.R_OK);
	} catch (ex) {
		return undefined;
	}
	return (0, _requireAll3.default)(options);
}

exports.default = requireAll;