import { StudioModel } from './models/StudioModel'
import { StudioProperty } from './models/StudioProperty'

export class CodeGenerator {
   /**
    * Generate the complete TypeScript code for a given Quatrain model
    * @param model The StudioModel object
    * @param properties An array of StudioProperty objects linked to this model
    */
   static generateModelCode(model: StudioModel, properties: StudioProperty[]): string {
      const modelName = model.val('name')
      const collectionName = model.val('collectionName')
      const isPersisted = model.val('isPersisted')

      const baseClass = isPersisted ? 'PersistedBaseObject' : 'BaseObject'
      const baseImport = isPersisted ? "@quatrain/backend" : "@quatrain/core"
      
      // Collect property types for imports
      const propTypes = new Set<string>()
      properties.forEach(p => propTypes.add(p.val('propertyType')))

      let imports = `import { ${baseClass} } from '${baseImport}'\n`
      imports += `import { BaseObjectType, htmlType, ${Array.from(propTypes).join(', ')} } from '@quatrain/core'\n`

      // Generate Interface
      const basePropNames = ['name', 'status', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt']
      const filteredProps = properties.filter(p => !basePropNames.includes(p.val('name')))

      let interfaceProps = ''
      filteredProps.forEach(p => {
         // Simple mapping for TS types
         let tsType = 'string'
         if (p.val('propertyType') === 'BooleanProperty') tsType = 'boolean'
         if (p.val('propertyType') === 'NumberProperty') tsType = 'number'
         if (p.val('propertyType') === 'DateTimeProperty') tsType = 'Date'
         
         const opt = p.val('mandatory') ? '' : '?'
         interfaceProps += `   ${p.val('name')}${opt}: ${tsType}\n`
      })

      const interfaceCode = `
export interface ${modelName}Type extends BaseObjectType {
${interfaceProps}   [x: string]: any
}
`

      // Generate PROPS_DEFINITION
      let propsDef = ''
      filteredProps.forEach(p => {
         propsDef += `   {\n`
         propsDef += `      name: '${p.val('name')}',\n`
         propsDef += `      mandatory: ${p.val('mandatory') ? 'true' : 'false'},\n`
         propsDef += `      type: ${p.val('propertyType')}.TYPE,\n`
         if (p.val('minLength') !== undefined) propsDef += `      minLength: ${p.val('minLength')},\n`
         if (p.val('maxLength') !== undefined) propsDef += `      maxLength: ${p.val('maxLength')},\n`
         propsDef += `   },\n`
      })

      const propsDefCode = `
export const ${modelName}Properties: any = [
${propsDef}]
`

      // Generate Class
      const classCode = `
export class ${modelName} extends ${baseClass} {
   static PROPS_DEFINITION = ${modelName}Properties
   static COLLECTION = '${collectionName}'

   static async factory(src: any = undefined): Promise<${modelName}> {
      return super.factory(src, ${modelName})
   }
}
`

      return `${imports}${interfaceCode}${propsDefCode}${classCode}`
   }
}
