# Client Errors

At various stages in the request/response life cycle, errors can arise. Generally there are two types of errors in an
API application: those that occur at the server level (connection errors, timeouts, runtime errors, and so on), called
"internal server errors," and those that are caused by a problem with the request (unauthenticated, forbidden, malformed
payloads, etc.), called "client errors." We distinguish these because, typically, the details of internal server errors
are significant to the systems administrators and developers and should be hidden from the client, while client errors
are often unimportant to the ops team and critical to the API's consumer.

Autonym considers any error to fall into the internal server error category, unless it is explicitly an instance of a
special class called ClientError. The ClientError class and its subclasses are exported by a module called
`autonym-client-errors`. JSON schema validation already throws instances of ClientError, but custom policies or model
methods that need to throw errors that should be seen by the client should wrap their errors in a subclass of
ClientError or the client will just receive a 500 error.

## Usage

Client errors are included in the `autonym-client-errors` package and are named exports. Just import the error class you
intend to use, instantiate it according to the API, and throw it in a model method, store, or policy.

```js
import {UnauthorizedError} from 'autonym-client-errors';

function isLoggedIn (req) {
  if (!req.isLoggedIn) {
    throw new UnauthorizedError('You are not logged in.');
  }
}

export default isLoggedIn;
```

When checking to see if an error object is a derivative of ClientError, `err instanceof ClientError` is *not* the best
solution. Third-party packages that depend on `autonym-client-errors` may have its own copy of the module, meaning that
the ClientError class is a different reference. To solve this issue, another package named `instance-of-name` will check
to see if the error is derived from a class with a certain name instead of resolving to the exact reference.

```js
import instanceOf from 'instance-of-name';

function handleError (err) {
  if (!instanceOf(err, 'ClientError') {
    // An internal server error occurred
    setImmediate(() => { throw err; });
  }
}

export default handleError;
```

## API

### ClientError(status, message)

ClientError has subclasses that describe specific error cases. Typically ClientError is not instantiated directly. It is
instantiated with a status code and message describing the nature of the error, which can be of any JSON-serializable
type.

### BadRequestError(message)

BadRequest errors return 400 status codes and include a message describing what was wrong with the request.

### ForbiddenError(message)

Forbidden errors return 403 status codes and include a message describing why the user was not allowed to perform the
request.

### InvalidPayloadError(ajvErrors)

InvalidPayload errors are used directly by the JSON schema validator. They are subclassed from BadRequest and return
an error message in a specific format that's designed to be parseable by the client to determine which field(s) were
sent incorrectly.

### MethodNotAllowedError(message)

MethodNotAllowed errors return 405 status codes and include a message describing that the request method does not apply
to the given resource type. These are used directly by Autonym if a request is made for a model that does not implement
that method, e.g. if a DELETE request is made to a resource whose model does not implement a `_findOneAndDelete` method.

### NotFoundError(message)

NotFound errors return 404 status codes and include a message describing that the requested resource was not found.
These are used directly by Autonym if a request is made to get, update, or delete a nonexistent resource, or to make any
request against a nonexistent model.

### UnauthorizedError(message)

Unauthorized errors return 401 status codes and include a message describing that the user was not authorized to
perform the request.
