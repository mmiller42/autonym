import { difference } from 'lodash'
import maybePromiseFactory from 'maybe-promise-factory'

export function checkForUnrecognizedProperties(parameterName, object, expectedProperties) {
  const invalidKeys = difference(Object.keys(object), expectedProperties)
  if (invalidKeys.length !== 0) {
    throw new TypeError(`Unexpected properties on ${parameterName} parameter: "${invalidKeys.join('", "')}".`)
  }
}

export const maybePromise = maybePromiseFactory()
