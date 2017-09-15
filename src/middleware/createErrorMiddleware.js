import AutonymError from '../AutonymError'

export default function createErrorMiddleware() {
  return (_error, req, res, next) => {
    if (!res.autonym) {
      next(_error)
      return
    }

    const error = AutonymError.fromError(_error)
    res.autonym.setStatus(error.getStatus())
    res.autonym.setData(error.getPayload())

    next(error)
  }
}
