// @see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete
// @see https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill

export const OFF = 'off'
export const NAME = 'name'
export const GIVEN_NAME = 'given-name'
export const FAMILY_NAME = 'family-name'
export const EMAIL = 'email'
export const PASSWORD = 'password'
export const BIRTHDAY = 'bday'
export const GENDER = 'sex'
export const ORG = 'organization'

export type PropertyHTMLType =
   | typeof OFF
   | typeof NAME
   | typeof GIVEN_NAME
   | typeof FAMILY_NAME
   | typeof EMAIL
   | typeof PASSWORD
   | typeof BIRTHDAY
   | typeof GENDER
   | typeof ORG
