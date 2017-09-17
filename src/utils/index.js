/* eslint-disable import/prefer-default-export */

import { difference } from 'lodash'

export function checkForUnrecognizedProperties(parameterName, object, expectedProperties) {
  const invalidKeys = difference(Object.keys(object), expectedProperties)
  if (invalidKeys.length !== 0) {
    throw new TypeError(`Unexpected properties on ${parameterName} parameter: "${invalidKeys.join('", "')}".`)
  }
}
