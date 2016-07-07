import should from 'should';
import sinon from 'sinon';
import path from 'path';
import Autonym from '../lib/autonym';

const j = path.join;
const APP_PATH = j(__dirname, '_fixtures/app');

describe('Autonym', () => {
	describe('.loadFromPath', () => {
		let loaded;
		beforeEach(() => {
			loaded = Autonym.loadFromPath(APP_PATH);
		});

		it('fetches all the models from the models directory, ignoring non-model files', () => {
			Object.keys(loaded.models).length.should.equal(3);
		});
		
		it('maps the model property name by converting the filename minus extension to PascalCase', () => {
			loaded.models.should.have.ownProperty('MovieCharacter');
			loaded.models.should.have.ownProperty('Person');
			loaded.models.should.have.ownProperty('Vehicle');
		});

		it('sets the model values to the default export', () => {
			loaded.models.MovieCharacter.should.equal(require(j(APP_PATH, 'models/movie-character.model')).default);
			loaded.models.Person.should.equal(require(j(APP_PATH, 'models/person.model')).default);
			loaded.models.Vehicle.should.equal(require(j(APP_PATH, 'models/vehicle.model')).default);
		});
		
		it('fetches all the schemas from the schemas directory, ignoring non-schema files', () => {
			Object.keys(loaded.schemas).length.should.equal(3);
		});
		
		it('maps the schema property name by converting the filename minus extension to PascalCase', () => {
			loaded.schemas.should.have.ownProperty('MovieCharacter');
			loaded.schemas.should.have.ownProperty('Person');
			loaded.schemas.should.have.ownProperty('Vehicle');
		});
		
		it('sets the schema values to the JSON object defined in the schema file', () => {
			loaded.schemas.MovieCharacter.should.equal(require(j(APP_PATH, 'schemas/movie-character.schema.json')));
			loaded.schemas.Person.should.equal(require(j(APP_PATH, 'schemas/person.schema.json')));
			loaded.schemas.Vehicle.should.equal(require(j(APP_PATH, 'schemas/vehicle.schema.json')));
		});
		
		it('fetches all the policies from the policies directory, ignoring non-policy files', () => {
			Object.keys(loaded.policies).length.should.equal(2);
		});
		
		it('maps the policy property name by converting the filename minus extension to camelCase', () => {
			loaded.policies.should.have.ownProperty('isAdmin');
			loaded.policies.should.have.ownProperty('isSelf');
		});
		
		it('sets the policy values to the policy function defined in the file', () => {
			loaded.policies.isAdmin.should.equal(require(j(APP_PATH, 'policies/is-admin.policy')).default);
			loaded.policies.isSelf.should.equal(require(j(APP_PATH, 'policies/is-self.policy')).default);
		});
	});
	
	describe('#constructor', () => {
		describe('when invoked with a components object', () => {
			runConstructorTests(() => new Autonym(Autonym.loadFromPath(APP_PATH)));
		});

		describe('when invoked with a path to load from', () => {
			runConstructorTests(() => new Autonym(APP_PATH));
		});
		
		function runConstructorTests (instantiateAutonym) {
			it('sets the property `schemas` on the instance to a hash of schemas, keyed by `id` or by the schema filename ' +
				'if there was no `id` property on the schema', () => {
				const autonym = instantiateAutonym();

				autonym.schemas.MovieCharacter.should.equal(require(j(APP_PATH, 'schemas/movie-character.schema.json')));
				autonym.schemas.Human.should.equal(require(j(APP_PATH, 'schemas/person.schema.json')));
				autonym.schemas.Vehicle.should.equal(require(j(APP_PATH, 'schemas/vehicle.schema.json')));
			});

			it('sets the property `models` on the instance to a hash of models, keyed by the exported class\' name or by ' +
				'the model filename if the class was anonymous', () => {
				const autonym = instantiateAutonym();
				return autonym.modelsInitialized.then(() => {
					autonym.models.MovieCharacter.should.equal(require(j(APP_PATH, 'models/movie-character.model')).default);
					autonym.models.Human.should.equal(require(j(APP_PATH, 'models/person.model')).default);
					autonym.models.Vehicle.should.equal(require(j(APP_PATH, 'models/vehicle.model')).default);
				});
			});
			
			it('sets the property `policies` on the instance to a hash of policies, keyed by the exported function\'s name ' +
				'or by the policy filename if the function was anonymous', () => {
				const autonym = instantiateAutonym();
				
				autonym.policies.userIsAdmin.should.equal(require(j(APP_PATH, 'policies/is-admin.policy')).default);
				autonym.policies.isSelf.should.equal(require(j(APP_PATH, 'policies/is-self.policy')).default);
			});

			it('calls the `init` method on the models, passing the schema with the same key', () => {
				const Human = require(j(APP_PATH, 'models/person.model')).default;

				let spy = sinon.spy(Human, 'init');

				const autonym = instantiateAutonym();
				return autonym.modelsInitialized.then(() => {
					spy.calledOnce.should.be.true();
					spy.getCall(0).args[0].should.equal(require(j(APP_PATH, 'schemas/person.schema')));

					spy.restore();
				});
			});

			it('sets the static property `route` on models to the plural kebab-case version of the model name if it does ' +
				'not already exist', () => {
				const autonym = instantiateAutonym();
				return autonym.modelsInitialized.then(() => {
					autonym.models.MovieCharacter.route.should.equal('movie-characters');
					autonym.models.Human.route.should.equal('humans');
					autonym.models.Vehicle.route.should.equal('cars');
				});
			});

			it('mounts the ModelRouter and ErrorRouter to the `middleware` router property', () => {
				const autonym = instantiateAutonym();
				return autonym.modelsInitialized.then(() => {
					autonym.middleware.should.be.a.Function();
					autonym.middleware.stack[0].handle.__autonym__.should.equal('ModelRouter');
					autonym.middleware.stack[1].handle.__autonym__.should.equal('ErrorRouter');
				});
			});
		}
	});
});
