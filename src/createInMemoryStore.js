import AutonymError from './AutonymError'

/**
 * Creates a store that reads and writes data in memory.
 * @returns {Store} A complete set of store methods.
 */
const createInMemoryStore = () => {
  const records = []
  let counter = 0
  const findRecordIndex = id => {
    const index = records.findIndex(record => record.id === id)
    if (index < 0) {
      throw new AutonymError(AutonymError.NOT_FOUND, 'Record not found')
    }
    return index
  }

  return {
    create: data => records[records.push({ ...data, id: String(++counter) }) - 1],
    find: () => records,
    findOne: id => records[findRecordIndex(id)],
    findOneAndUpdate: (id, data) => Object.assign(records[findRecordIndex(id)], data),
    findOneAndDelete: id => records.splice(findRecordIndex(id), 1)[0],
  }
}

export default createInMemoryStore