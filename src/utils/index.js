import { difference } from 'lodash'

export function checkForUnrecognizedProperties(parameterName, object, expectedProperties) {
  const invalidKeys = difference(Object.keys(object), expectedProperties)
  if (invalidKeys.length !== 0) {
    throw new TypeError(`Unexpected properties on ${parameterName} parameter: "${invalidKeys.join('", "')}".`)
  }
}

export function cloneInstance(instance, newProps) {
  return Object.assign(Object.create(Object.getPrototypeOf(instance)), instance, newProps)
}
