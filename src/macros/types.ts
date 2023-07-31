// Work-in-progress
// Trying to convert the DataObjectProperties type to an object type
// Such as [{ name: 'name', type: 'string' }, { name: 'age', type: 'number' }] would become { name: string, age: number }

type Prop = { name: string }[]

type ValuesOf<T extends Prop> = T[keyof T]

//type Mod<T extends Prop> = { [x in ValuesOf<T>['name']]: unknown }

export enum Type {
   NUMBER = 'number',
   STRING = 'string',
   DATETIME = 'datetime',
   OBJECT = 'object',
   ENUM = 'enum',
}

type Properties = {
   [x in string]: {
      type: Type.NUMBER | Type.STRING | Type.DATETIME | Type.OBJECT | Type.ENUM
      mandatory?: boolean
      minLength?: number
      maxLength?: number
   }
}

function toModel<T extends Prop>(props: T) {
   return
}

type Mandatory<
   isMandatory extends boolean | undefined,
   T
> = isMandatory extends true ? T : T | undefined

type StringProperty<
   minLength extends number | undefined,
   maxLength extends number | undefined
> = string

export type Model<T extends Properties> = {
   [K in keyof T]: Mandatory<
      T[K]['mandatory'],
      T[K]['type'] extends Type.NUMBER
         ? number
         : StringProperty<T[K]['minLength'], T[K]['maxLength']>
   >
}

function properties<T extends Properties>(props: T): T {
   return props
}

const userProps = properties({
   name: { type: Type.STRING, mandatory: true },
   age: { type: Type.NUMBER },
})

type User = Model<typeof userProps>
