import AutonymError from '../AutonymError'

export default function createErrorMiddleware() {
  return (error, req, res, next) => {
    if (!res.autonym) {
      next(error)
      return
    }

    const autonymError = AutonymError.fromError(error)
    res.autonym._isPopulated = true
    res.autonym.setStatus(autonymError.getStatus())
    res.autonym._setErrorData(autonymError.getPayload())

    next(autonymError)
  }
}
