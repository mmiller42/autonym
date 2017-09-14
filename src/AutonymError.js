import HTTP from 'http-status-codes'

export default class AutonymError extends Error {
  static BAD_REQUEST = 'BAD_REQUEST'
  static FORBIDDEN = 'FORBIDDEN'
  static NOT_ACCEPTABLE = 'NOT_ACCEPTABLE'
  static METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED'
  static NOT_FOUND = 'NOT_FOUND'
  static UNAUTHORIZED = 'UNAUTHORIZED'
  static INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'

  static CLIENT_ERRORS = [
    AutonymError.BAD_REQUEST,
    AutonymError.FORBIDDEN,
    AutonymError.NOT_ACCEPTABLE,
    AutonymError.METHOD_NOT_ALLOWED,
    AutonymError.NOT_FOUND,
    AutonymError.UNAUTHORIZED,
  ]

  static fromError(error) {
    if (error.isAutonymError) {
      return error
    } else {
      return new AutonymError(
        error.code || AutonymError.INTERNAL_SERVER_ERROR,
        error.message || 'An unknown error occurred.',
        error.toJSON ? error.toJSON() : error
      )
    }
  }

  constructor(code, message, data = {}) {
    super(`${code}\n${message}\n${data}`)
    this._code = code
    this._message = message
    this._data = data
    this._isClientError = false
    this.isAutonymError = true
  }

  getCode() {
    return this._code
  }

  getMessage() {
    return this._message
  }

  getStatus() {
    return HTTP[this.getCode()] || HTTP.INTERNAL_SERVER_ERROR
  }

  getData() {
    return this._data
  }

  getPayload() {
    if (this.isClientError()) {
      return { ...this.getData(), message: this.getMessage() }
    } else {
      return { message: 'An internal server error occurred.' }
    }
  }

  toClientError() {
    const clientError = new AutonymError(this.getCode(), this.getMessage(), this.getData())
    clientError._isClientError = true
    return clientError
  }

  isClientError() {
    return this._isClientError && AutonymError.CLIENT_ERRORS.includes(this.getCode())
  }
}
