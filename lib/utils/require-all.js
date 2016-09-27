import _requireAll from 'require-all';
import fs from 'fs';

function requireAll (options) {
	try {
		fs.accessSync(options.dirname, fs.constants.R_OK);
	} catch (ex) {
		return undefined;
	}
	return _requireAll(options);
}

export default requireAll;
