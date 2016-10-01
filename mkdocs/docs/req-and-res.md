# req & res

Autonym adds some properties to the request and response objects used in Express middleware as a convenience. These are
listed here for reference. They can be accessed in middleware that follows after Autonym has been executed on the
request. In addition, the fully hydrated `req` object is passed into policies.

## req

### data

`req.data` is a plain object that contains the validated and filtered body of the request. This is passed to the create
and update actions.

### completeResource

`req.completeResource` is only defined for the update action. Like `req.data`, it is a plain object, but it represents
the complete resource to be updated, rather than just the partial resource passed to the API. This is useful if you need
to set criteria in a query, if you need to perform policy validation on other parts of the resource, or your data store
requires a complete swap of the document.

### filter

`req.filter` is an array that always starts off empty but can be pushed to by policies. It is passed to all of the CRUD
actions on the model. It is useful for things like restricting the result set to only records the user has permission to
view or edit, or force the property of all records to a static value. It is up to the model (or store) to implement the
filter.

There is no predefined format for an element in the filter array, as how filters are used depends on the model's
interpretation. The [autonym-postgres-store](https://github.com/mmiller42/autonym-postgres-store), as an example,
defines a filter as an object with `field`, `value`, and `operator` keys, e.g.
`{field: 'employerId', value: '42', operator: '='}`, and the store converts these into conditions in a SQL query, joined
by *AND*. Other models or their underlying stores may implement a different definition for a filter.

### models

`req.models` is a list of all the models registered in the Autonym application. This is especially useful if you need to
do cross-model validation. Use the public methods on other models, e.g. `req.models.Person.findOne('123').then(...)`.
(By "public methods" we mean methods not prefixed by an underscore. These methods are inherited from the abstract
`Model` class and wrap the internal underscore-prefixed methods with pre- and post-hooks, such as schema and policy
validation.)

### Model

`req.Model` is the class for the current model that the action is performed against. This is useful if a policy is
shared by multiple models but needs to perform an action against the current model being validated. Use the public
methods, e.g. `req.Model.findOne(123).then(...)`.

### crudMethod

`req.crudMethod` is set to one of `create`, `find`, `findOne`, `findOneAndUpdate`, or `findOneAndDelete`, based on the
request type.

### resourceId

`req.resourceId` is set to the resource id for `findOne`, `findOneAndUpdate`, and `findOneAndDelete` actions. Otherwise
it is `null`. Note that the id is always a string, so be careful when making strict comparisons if your store uses
number types.

### getting

`req.getting` is `true` for `find` and `findOne` requests.

### finding

`req.finding` is `true` for `find` requests only.

### findingOne

`req.findingOne` is `true` for `findOne`, `findOneAndUpdate`, and `findOneAndDelete` requests.

### creating

`req.creating` is `true` for `create` requests only.

### updating

`req.updating` is `true` for `findOneAndUpdate` requests only.

### deleting

`req.deleting` is `true` for `findOneAndDelete` requests only.

### hasBody

`req.hasBody` is `true` for `create` and `findOneAndUpdate` requests.

### writing

`req.writing` is `true` for `create`, `findOneAndUpdate`, and `findOneAndDelete` requests.

### reading
`req.reading` is `true` for `create`, `find`, `findOne`, and `findOneAndUpdate` requests.

## res

### data

`res.data` is set to the data that should be sent in the response, and must be JSON-serializable. It is `null` for
`findOneAndDelete` requests. It may contain a representation of a resource, an array of resources, or details about an
error that occurred.
