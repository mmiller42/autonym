import should from 'should';
import sinon from 'sinon';
import _ from 'lodash';
import {MethodNotAllowedError} from 'autonym-client-errors';
import Model from '../lib/model.abstract';

describe('Model', () => {
	const schema = {type: 'object', properties: {something: {type: 'boolean'}}, required: ['something']};

	describe('.init', () => {
		it('creates a `validateAgainstSchema` method on the class', () => {
			class Test extends Model {}
			return Test.init(schema).then(() => {
				Test.validateAgainstSchema.should.be.a.Function();
			});
		});
		
		it('creates a `validateAgainstSchema` method even if there is no schema', () => {
			class Test extends Model {}
			return Test.init().then(() => {
				Test.validateAgainstSchema.should.be.a.Function();
			});
		});
		
		it('returns the Promise returned from the private `_init` method if it exists', () => {
			class Test extends Model {
				static _init () { return Promise.resolve('abc'); }
			}
			
			return Test.init().then(result => {
				result.should.equal('abc');
			});
		});
		
		it('casts a non-Promise to a Promise when returning the result of the private `_init` method', () => {
			class Test extends Model {
				static _init () { return 'def'; }
			}

			return Test.init().then(result => {
				result.should.equal('def');
			});
		});
	});
	
	describe('.validateAgainstSchema', () => {
		it('validates the data against the given schema and resolves if the data is valid', () => {
			class Test extends Model {}
			return Test.init(schema).then(() => {
				return Test.validateAgainstSchema({something: true});
			});
		});
		
		it('validates the data against the given schema and rejects if the validation fails', () => {
			class Test extends Model {}

			const spy = sinon.spy();
			return Test.init(schema).then(() => {
				return Test.validateAgainstSchema({something: 'red'})
					.then(() => spy(new Error('Should have thrown an error')))
					.catch(() => spy())
					.then(() => {
						spy.callCount.should.equal(1);
						should(spy.getCall(0).args[0]).be.undefined();
					});
			});
		});
		
		it('removes extraneous properties on the data', () => {
			const data = {something: true, hello: 'world'};
			
			class Test extends Model {}
			return Test.init(schema)
				.then(() => {
					return Test.validateAgainstSchema(data);
				})
				.then(() => {
					data.something.should.be.true();
					should(data.hello).be.undefined();
				});
		});
	});
	
	describe('.validate', () => {
		it('calls `_preValidateAgainstSchema` if it is defined on the model prior to schema validation', () => {
			const req = {hasBody: true, body: {hello: 'world'}};

			class Test extends Model {
				static _preValidateAgainstSchema (req) {
					req.body.pre = true;
					return Promise.resolve();
				}
			}

			return Test.init({type: 'object', required: ['hello', 'pre']})
				.then(() => {
					return Test.validate(req);
				})
				.then(() => {
					req.body.pre.should.be.true();
				});
		});

		it('calls `_postValidateAgainstSchema` if it is defined on the model after schema validation', () => {
			const req = {hasBody: true, body: {hello: 'world'}};

			class Test extends Model {
				static _postValidateAgainstSchema (req) {
					req.data.post = true;
				}
			}

			return Test.init({type: 'object', required: ['hello']})
				.then(() => {
					return Test.validate(req);
				})
				.then(() => {
					req.data.post.should.be.true();
				});
		});
		
		it('does not modify the original request body when validating against the schema', () => {
			const req = {hasBody: true, body: {hello: 'world', nonexistent: 'property'}};
			class Test extends Model {}
			
			return Test.init({type: 'object', properties: {hello: {type: 'string'}}})
				.then(() => {
					return Test.validate(req);
				})
				.then(() => {
					req.body.hello.should.equal('world');
					req.body.nonexistent.should.equal('property');
					req.data.hello.should.equal('world');
					should(req.data.nonexistent).be.undefined();
				});
		});
		
		it('merges a partial resource with the stored resource for validation when updating', () => {
			const req = {hasBody: true, updating: true, resourceId: 42, body: {lastName: 'Galt', discard: 'me'}};
			const schema = {
				type: 'object',
				properties: {firstName: {type: 'string'}, lastName: {type: 'string'}},
				required: ['firstName', 'lastName']
			};
			
			class Test extends Model {
				static findOne (resourceId) {
					return Promise.resolve({firstName: 'Dagny', lastName: 'Taggart'});
				}
			}
			
			return Test.init(schema)
				.then(() => {
					return Test.validate(req);
				})
				.then(() => {
					req.data.should.eql({lastName: 'Galt'});
					req.completeResource.should.eql({firstName: 'Dagny', lastName: 'Galt'});
				});
		});
	});
	
	['create', 'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete'].forEach(method => {
		describe(`.${method}`, () => {
			it('calls the private method on the model if it exists and resolves with the result', () => {
				class Test extends Model {
					static [`_${method}`] () {
						return Promise.resolve(method === 'find' ? [] : {});
					}
				}
				
				return Test.init()
					.then(() => {
						return Test[method]();
					})
					.then(result => {
						result.should.eql(method === 'find' ? [] : {});
					});
			});
			
			it('rejects with a MethodNotAllowedError if the private method is unimplemented', () => {
				class Test extends Model {}
				
				return Test.init()
					.then(() => {
						return Test[method]();
					})
					.then(() => {
						throw new Error('Expected an error');
					})
					.catch(err => {
						err.should.be.instanceof(MethodNotAllowedError);
					});
			});

			switch (method) {
				case 'find':
					it('unserializes each resource in the array before resolving with it', () => {
						class Test extends Model {
							static unserialize (attributes) { return _.mapKeys(attributes, (v, attr) => _.camelCase(attr)); }
							
							static _find () {
								return Promise.resolve([
									{first_name: 'Dagny', last_name: 'Taggart'},
									{first_name: 'John', last_name: 'Galt'}
								]);
							}
						}

						return Test.init()
							.then(() => {
								return Test.find({});
							})
							.then(results => {
								console.log(results);
								results.should.eql([
									{firstName: 'Dagny', lastName: 'Taggart'},
									{firstName: 'John', lastName: 'Galt'}
								]);
							});
					});
					break;

				case 'create':
				case 'findOneAndUpdate':
					it('serializes the resource before passing it to the private method', () => {
						class Test extends Model {
							static serialize (attributes) { return _.mapKeys(attributes, (v, attr) => _.snakeCase(attr)); }
							
							static [`_${method}`] (attributes) {
								if (method === 'findOneAndUpdate') { attributes = arguments[1]; }
								attributes.should.eql({first_name: 'Dagny', last_name: 'Taggart'});
								return Promise.resolve();
							}
						}

						return Test.init()
							.then(() => {
								let args = [{firstName: 'Dagny', lastName: 'Taggart'}];
								if (method === 'findOneAndUpdate') { args = [1, ...args]; }
								return Test[method](...args);
							});
					});

				case 'findOne':
					it('unserializes the resource before resolving with it', () => {
						class Test extends Model {
							static unserialize (attributes) { return _.mapKeys(attributes, (v, attr) => _.camelCase(attr)); }
							
							static [`_${method}`] () {
								return Promise.resolve({first_name: 'Dagny', last_name: 'Taggart'});
							}
						}
						
						return Test.init()
							.then(() => {
								return Test[method]();
							})
							.then(result => {
								result.should.eql({firstName: 'Dagny', lastName: 'Taggart'});
							});
					});
					break;
			}
		});
	});

	['serialize', 'unserialize'].forEach(method => {
		describe(`.${method}`, () => {
			it('clones the attributes', () => {
				class Test extends Model {}
				const obj = {a: 1, b: 2};
				const result = Test[method](obj);
				result.should.eql({a: 1, b: 2});
				result.should.not.equal(obj);
			});

			it('passes it to the private method if it exists', () => {
				class Test extends Model {
					static [`_${method}`] (attributes) {
						return _.mapKeys(attributes, (value, attribute) => attribute.toUpperCase());
					}
				}
				const obj = {a: 1, b: 2};
				const result = Test[method](obj);
				result.should.eql({A: 1, B: 2});
				result.should.not.equal(obj);
			});
		});
	});
	
	describe('._implementDefaultStoreCrudMethods', () => {
		it('adds a private method for each of the given public methods on the given store to the class', () => {
			class Test extends Model {}
			class Store {
				find (query) { return Promise.resolve([]); }
				findOne (id) { return Promise.resolve({}); }
			}
			const store = new Store();
			const findSpy = sinon.spy(store, 'find');
			const findOneSpy = sinon.spy(store, 'findOne');
			
			Test._implementDefaultStoreCrudMethods(store, ['find', 'findOne']);
			return Promise.all([Test.find({}), Test.findOne(1, [{field: 'owner', value: '1'}])]).then(results => {
				findSpy.getCall(0).args.should.eql([{}, undefined]);
				results[0].should.eql([]);
				findOneSpy.getCall(0).args.should.eql([1, [{field: 'owner', value: '1'}]]);
				results[1].should.eql({});
			});
		});

		it('does not override existing methods on the class', () => {
			class Test extends Model {
				static _findOne (id) {}
			}
			const findOne = Test._findOne;

			class Store {
				findOne (id) {}
			}
			const store = new Store();

			Test._implementDefaultStoreCrudMethods(store, ['findOne']);
			Test._findOne.should.equal(findOne);
		});

		it('does not attempt to add a method if it does not exist on the store', () => {
			class Test extends Model {}

			class Store {
				findOne (id) {}
			}
			const store = new Store();

			Test._implementDefaultStoreCrudMethods(store, ['findOne', 'create']);
			Test._findOne.should.be.a.Function();
			should(Test._create).be.undefined();
		});
	});
});
