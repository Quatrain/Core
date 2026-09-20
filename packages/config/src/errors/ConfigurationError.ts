/**
 * Specialized error thrown when a required configuration value is missing,
 * blank, or fails schema validation.
 */
export class ConfigurationError extends Error {
   readonly key: string
   readonly namespace: string
   readonly helpText?: string

   /**
    * Create a new ConfigurationError.
    *
    * @param key - The property path or key that failed validation.
    * @param namespace - The configuration alias or namespace.
    * @param message - Detailed error explanation.
    * @param helpText - Optional remediation guidance for developers.
    */
   constructor(
      key: string,
      namespace: string,
      message: string,
      helpText?: string,
   ) {
      const guidance = helpText ? ` ${helpText}` : ''
      const fullMessage = `[Config:${namespace}] ${message} for key "${key}".${guidance}`

      super(fullMessage)
      this.name = 'ConfigurationError'
      this.key = key
      this.namespace = namespace
      this.helpText = helpText

      // Maintain prototype chain across transpilation targets
      Object.setPrototypeOf(this, new.target.prototype)
   }
}
