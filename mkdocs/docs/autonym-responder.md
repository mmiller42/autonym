# AutonymResponder

The AutonymResponder will dispatch a response to the client. Once Autonym has finished handling the request, it sets
some properties on the `req` object (or passes an error along) which will be consumed by the AutonymResponder, which
determines what response to send. AutonymResponder will also try to determine if any error was due to bad client data or
an issue on your server and send the appropriate response.

## Constructor arguments

The AutonymResponder constructor takes one optional argument, which is a function to handle errors. The function is
executed any time an error occurs (whether it is a client or system error) so that your app can take appropriate action,
such as logging the event, triggering an alert, or crashing and restarting.

This function just takes the error object as its only parameter.

If no argument is supplied, then Autonym will simply pass the error to the next error-handling middleware in the Express
stack. Often this handler is the default one provided by Express, which will log the exception to stderr and carry on.

## What the middleware does with the response

If an error occurred, the error handler function will be passed the error. If there was no error handler function
provided, it will pass the error to the next middleware.

If the response is not already sent, then AutonymResponder will:

1. Check for a property named `data` on the response object.
1. If it exists and is not null, it will send the response, with a JSON body set to the value of `res.data`.
    1. If `res.data` is null, it will send the response with no body.
1. Otherwise, it will return a 404 error.

## AutonymResponder API

### #constructor(handleError)

Creates a new instance of AutonymResponder, optionally taking a function to handle errors.

### #handleError

The function supplied to the constructor, or `undefined`. Can be changed at runtime.

### #middleware

Express middleware that can be mounted to your application to send the response and capture errors.
