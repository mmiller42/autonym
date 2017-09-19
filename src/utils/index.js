import { difference, isPlainObject, reduce } from 'lodash'

export function checkForUnrecognizedProperties(parameterName, object, expectedProperties) {
  if (!object) {
    return
  }

  const invalidKeys = difference(Object.keys(object), expectedProperties)
  if (invalidKeys.length !== 0) {
    throw new TypeError(`Unexpected properties on ${parameterName} parameter: "${invalidKeys.join('", "')}".`)
  }
}

export function cloneInstance(instance, newProps) {
  return Object.assign(Object.create(Object.getPrototypeOf(instance)), instance, newProps)
}

export function replaceObject(destination, source) {
  Object.keys(destination, property => {
    delete destination[property]
  })
  return Object.assign(destination, source)
}

export function filterToProperties(fullObject, partialObject) {
  return reduce(
    fullObject,
    (result, value, key) => {
      if (key in partialObject) {
        const partialValue = partialObject[key]
        if (isPlainObject(value) && isPlainObject(partialValue)) {
          result[key] = filterToProperties(value, partialValue)
        } else if (Array.isArray(value) && Array.isArray(partialValue)) {
          result[key] = partialValue.map((partialValueItem, i) => filterToProperties(value[i], partialValueItem))
        } else {
          result[key] = partialValue
        }
      }
      return result
    },
    {}
  )
}
