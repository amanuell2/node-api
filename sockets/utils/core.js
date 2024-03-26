const ajv = require('ajv')

const sanitizeInputs = (schema, input) => {
  return new Promise((resolve, reject) => {
    /*
	  const validate = new ajv().compile(schema)

    const valid = validate(input)

    if (!valid) {
      reject(validate.errors)
    } else {
      resolve()
    }*/
	  resolve();
  })
}

module.exports = {
  sanitizeInputs
}
