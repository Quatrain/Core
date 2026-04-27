export interface SchemaDelta {
   added: any[]
   removed: any[]
   modified: { old: any, new: any }[]
}
