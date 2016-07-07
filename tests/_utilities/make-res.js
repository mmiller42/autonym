function makeRes (properties, done) {
	const res = Object.assign({
		status: code => { res._status = code; return res; },
		json: data => { res._json = data; return res.end(); },
		end: () => {
			if (res._ended) { throw new Error('Already sent'); }
			res._ended = true;
			done();
			return res;
		}
	}, properties);
	return res;
}

export default makeRes;
