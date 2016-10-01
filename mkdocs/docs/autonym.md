# Autonym

The Autonym class creates a new middleware instance that can be mounted to your Express application.

## Constructor arguments

The first argument to the constructor is typically the absolute path to the location of your `models`, `schemas`, and
`policies` directories. For instance, if the file where you instantiate Autonym is located at `/home/jgalt/app/app.js`
and your Autonym components live in `/home/jgalt/app/auto/models`, `/home/jgalt/app/auto/schemas`, and
`/home/jgalt/app/auto/policies`, then you would pass in `__dirname + '/auto'`.

Inside these directories, Autonym will load files if their names match these patterns:

* **Models:** `^models/(.+)\.model\.js$` (i.e. anything in the `models` directory named `ANYTHING.model.js`)
* **Schemas:** `^schemas/(.+)\.schema\.json$` (i.e. anything in the `schemas` directory named `ANYTHING.schema.json`)
* **Policies:** `^policies/(.+)\.policy\.js$` (i.e. anything in the `policies` directory named `ANYTHING.policy.js`)

Sometimes, the directory-based setup may not work for your application. For example, maybe you need to fetch your
schemas from another API and pass them in instead of pulling them directly off the filesystem. In this case, you can
instantiate Autonym by passing the three kinds of components directly into the constructor, like the following example.

```js
new Autonym({
  models: {
    Person: class Person extends Model {...}
  },
  schemas: {
    Person: {id: 'Person', type: 'object', ...}
  },
  policies: {
    isLoggedIn: function isLoggedIn (req) {...}
  }
});
```

## How components are named

It is important to understand the rules behind how components are named and referenced in the Autonym application.

### Models

Models are referenced by the name of the class that the model file exports. So for instance, if you write:

```js
class Person extends Model { }

export default Person;
```

Then the model will be referenced by the name *Person*. This is important to note, as if two model files export a class
with the same name, **the latter will overwrite the former**. The Autonym convention is to always export a named class
to reduce ambiguity, but take care to name your classes uniquely!

You can also export an anonymous class, e.g.:

```js
export default class extends Model { };
```

In this case, the filename will be converted to PascalCase and used as the identifier, e.g. `user-group.model.js` will
result in a model named `UserGroup`. If Autonym is instantiated with component references instead of a path, then the
key on the models object will be used as the identifier, e.g. `{models: {UserGroup: class extends Model {...}}` will
result in a model named `UserGroup`.

### Schemas

Schemas are referenced by the `id` property on the schema. So, for instance, if you write:

```json
{
  "id": "Person",
  "type": "object",
  ...
}
```

Then the schema will be referenced by the name `Person`. *To match a schema with a model, the `id` of the schema
**must** match the model's resolved name.*

Like models, it is important that no two schemas are assigned the same `id`, as the latter will overwrite the former.
The Autonym convention is to always export a named schema to reduce ambiguity, but take care to name your schemas
uniquely!

You can also omit the `id` property from the schema. In this case, the `id` will resolve to the filename converted to
PascalCase, e.g. `user-group.schema.json` will result in a schema named `UserGroup`. If Autonym is instantiated with
component references instead of a path, then the key on the schemas object will be used as the identifier, e.g.
`{schemas: {UserGroup: {type: 'object', ...}}}` will result in a schema named `UserGroup`.

### Policies

Policies are referenced by the name of the function that the policy file exports. So for instance, if you write:

```js
function isLoggedIn (req) {
  ...
}

export default isLoggedIn;
```

Then the policy will be referenced by the name `isLoggedIn`. Like models and schemas, ensure that every policy is named
uniquely, as latter policies will overwrite former policies if they are named the same. The Autonym convention is to
always export a named function to reduce ambiguity, but take care to name your policies uniquely!

You can also export an anonymous function, e.g.:

```js
export default function (req) {
  ...
};
```

In this case, the name will resolve to the filename converted to camelCase, e.g. `is-logged-in.policy.js` will result in
a policy named `isLoggedIn`. If Autonym is instantiated with component references instead of a path, then the key on the
policies object will be used as the identifier, e.g. `{policies: {isLoggedIn: function (req) { ... }}}` will result in a
policy named `isLoggedIn`.

## Autonym API

### #constructor(components)

Creates a new instance of Autonym, accepting either an absolute path to a directory containing subdirectories for
models, schemas, and policies, or an object with properties named `models`, `schemas`, and `policies` whose values are
collections of the specified component type.

### .loadFromPath(dirname)

Accepts an absolute path to a directory containing subdirectories for models, schemas, and policies. Synchronously
requires the components in these subdirectories and returns an object in the alternate format the constructor accepts,
i.e. an object with `models`, `schemas`, and `policies` which map to collections of components.

### #modelsInitialized

A promise that resolves when all the given models have finished initializing. Note that it is possible to dynamically
add models to Autonym at runtime but they should be manually initialized first. This promise only applies to the models
that were attached when the instance was constructed.

### #models

The models attached to this instance of Autonym. You can dynamically add models to this object at runtime if they are
already initialized, and they are named, not anonymous.

### #schemas

The schemas attached to this instance of Autonym. You can dynamically add schemas to this object at runtime if they have
an `id` property set.

### #policies

The policies attached to this instance of Autonym. You can dynamically add policies to this object at runtime if they
are named, not anonymous.

### #middleware

Express middleware that must be mounted to your application.

### #modelRouter

Provides direct access to the instance of ModelRouter, which handles requests and maps them to model CRUD actions.

### #errorRouter

Provides direct access to the instance of ErrorRouter, which handles exceptions raised in the ModelRouter and prepares
the response.
