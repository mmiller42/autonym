import HTTP from 'http-status-codes'

/**
 * Wrapper for any error that occurred in a policy or store method.
 */
export default class AutonymError extends Error {
  /**
   * Code indicating the server could not understand the request due to invalid syntax.
   * @constant
   * @type {string}
   */
  static BAD_REQUEST = 'BAD_REQUEST'

  /**
   * Code indicating the client does not have access rights to the content.
   * @constant
   * @type {string}
   */
  static FORBIDDEN = 'FORBIDDEN'

  /**
   * Code indicating the request was improper, i.e. failed schema validation.
   * @constant
   * @type {string}
   */
  static NOT_ACCEPTABLE = 'NOT_ACCEPTABLE'

  /**
   * Code indicating the requested store method is not available for this model.
   * @constant
   * @type {string}
   */
  static METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED'

  /**
   * Code indicating the requested resource does not exist.
   * @constant
   * @type {string}
   */
  static NOT_FOUND = 'NOT_FOUND'

  /**
   * Code indicating the client must be authenticated to perform this action.
   * @constant
   * @type {string}
   */
  static UNAUTHORIZED = 'UNAUTHORIZED'

  /**
   * Default. Code indicating an unhandled error occurred while the server was processing the request.
   * @constant
   * @type {string}
   */
  static INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'

  /**
   * The error codes that indicate client request errors, rather than internal errors.
   * @constant
   * @type {string[]}
   */
  static CLIENT_ERRORS = [
    AutonymError.BAD_REQUEST,
    AutonymError.FORBIDDEN,
    AutonymError.NOT_ACCEPTABLE,
    AutonymError.METHOD_NOT_ALLOWED,
    AutonymError.NOT_FOUND,
    AutonymError.UNAUTHORIZED,
  ]

  /**
   * Wraps the given error and returns an instance of AutonymError, or returns the given error if it already is an
   * AutonymError. If the error object has the property `code`, it will be used as the AutonymError code. If the
   * error object implements a `toJSON` method, its result will be stored as additional data.
   * @param {Error} error An error object.
   * @returns {AutonymError} The instance of AutonymError.
   * @example
   * const err = new Error('Something bad happened')
   * const autonymError = AutonymError.fromError(err)
   * console.log(autonymError.getPayload()) // { message: 'An internal server error occurred.' }
   * @example
   * const err = new Error('Something bad happened')
   * err.code = AutonymError.BAD_REQUEST
   * const autonymError = AutonymError.fromError(err)
   * // Still internal server error until we call `#toClientError()`
   * console.log(autonymError.getPayload()) // { message: 'An internal server error occurred.' }
   */
  static fromError(error) {
    if (error.isAutonymError) {
      return error
    } else {
      return new AutonymError(
        error.code || AutonymError.INTERNAL_SERVER_ERROR,
        error.message || 'An unknown error occurred.',
        typeof error.toJSON === 'function' ? error.toJSON() : error
      )
    }
  }

  /**
   * @param {string} [code] One of the error code static constants, or any other identifiable value for the error
   * type. If falsy, will fall back to `AutonymError.INTERNAL_SERVER_ERROR`.
   * @param {string} message A human-readable description of the error. It will only be passed to the client in a
   * response if the code is one of `Autonym.CLIENT_ERRORS`.
   * @param {object} [data] Additional metadata to store on the error.
   * @example
   * const autonymError = new AutonymError(null, 'Something bad happened')
   * @example
   * const autonymError = new AutonymError(AutonymError.BAD_REQUEST, 'Something bad happened', { invalid: 'xyz' })
   */
  constructor(code, message, data = {}) {
    super(`${code}\n${message}\n${data}`)
    this._code = code || AutonymError.INTERNAL_SERVER_ERROR
    this._message = message
    this._data = data
    this._isClientError = false
    this.isAutonymError = true
  }

  /**
   * Gets the error code.
   * @returns {string} The error code.
   */
  getCode() {
    return this._code
  }

  /**
   * Gets the error message.
   * @returns {string} The error message.
   */
  getMessage() {
    return this._message
  }

  /**
   * Gets the HTTP status code for the error based on its code, or falls back to `AutonymError.INTERNAL_SERVER_ERROR`.
   * @returns {number} The HTTP status code.
   */
  getStatus() {
    return HTTP[this.getCode() || AutonymError.INTERNAL_SERVER_ERROR]
  }

  /**
   * Gets the error metadata.
   * @returns {object} The error metadata.
   */
  getData() {
    return this._data
  }

  /**
   * Gets the data to send in the HTTP response. It will only return the error data and message if the error has
   * been converted to a client error and its code is one of `Autonym.CLIENT_ERRORS`.
   * @returns {object} The error payload. At a minimum, this object will have a `message` property.
   * @example
   * const err = new AutonymError(AutonymError.INTERNAL_SERVER_ERROR, 'Something bad happened.', { x: 2 })
   * console.log(err.getPayload()) // { message: 'An internal server error occurred.' }
   * @example
   * const err = new AutonymError(AutonymError.BAD_REQUEST, 'Something bad happened.', { x: 2 })
   * console.log(err.getPayload()) // { x: 2, message: 'Something bad happened.' }
   */
  getPayload() {
    if (this.isClientError()) {
      return { ...this.getData(), message: this.getMessage() }
    } else {
      return { message: 'An internal server error occurred.' }
    }
  }

  /**
   * Creates a copy of this error with a flag on it indicating it is a client error. Any error thrown will by
   * default be an internal server error, until it is converted to a client error and it has an applicable error code.
   * @returns {AutonymError} The client error.
   * @example
   * const clientError = new AutonymError(null, 'Something bad happened').toClientError()
   * console.log(clientError.isClientError()) // false
   * console.log(clientError.getPayload()) // { message: 'An internal server error occurred.' }
   * console.log(clientError.getStatus()) // 500
   * @example
   * const clientError = new AutonymError(AutonymError.BAD_REQUEST, 'Something bad happened').toClientError()
   * console.log(clientError.isClientError()) // true
   * console.log(clientError.getPayload()) // { message: 'Something bad happened' }
   * console.log(clientError.getStatus()) // 400
   */
  toClientError() {
    const clientError = new AutonymError(this.getCode(), this.getMessage(), this.getData())
    clientError._isClientError = true
    return clientError
  }

  /**
   * Checks if the error is a client error and its code is one of `Autonym.CLIENT_ERRORS`.
   * @returns {boolean} Whether it is a client error.
   */
  isClientError() {
    return this._isClientError && AutonymError.CLIENT_ERRORS.includes(this.getCode())
  }
}
