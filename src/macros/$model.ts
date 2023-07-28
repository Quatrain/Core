import { $defMacro } from 'shulk'
import { DataObject } from '../components'
import { Proxy, ProxyConstructor } from '../components/types/ProxyConstructor'
import { Property } from '../properties'

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

export const $model = <T extends Properties>(
   collection: string,
   properties: T
) =>
   $defMacro({
      props: { collection, properties },
      methods: {
         fromObject(self, obj: Model<typeof properties> & { name: string }) {
            return $proxy(self.properties, obj)
         },
      },
   })

const $proxy = <T extends Properties>(
   properties: Properties,
   obj: Model<T> & { name: string }
): Proxy<Model<T>> => {
   const parsedProps = Object.keys(properties).map((key) => ({
      name: key,
      ...properties[key],
   }))

   const dataObject = DataObject.factory({ properties: parsedProps })
   dataObject.populate(obj)

   const modelProps: { [x in keyof T]: () => Model<T>[x] } = Object.keys(
      properties
   ).reduce(
      (previous, current) => ({
         ...previous,
         [current]: (self: any) => self.core.dataObject.get(current),
      }),
      {}
   ) as { [x in keyof T]: () => Model<T>[x] }

   const model = $defMacro({
      props: { dataObject, uid: dataObject.uid, uri: dataObject.uri },
      methods: {
         val: (self, key: string) => self.dataObject.val(key),
         set: (self, key: string, val: unknown) =>
            self.dataObject.set(key, val),
         get: (self, key: string) => self.dataObject.get(key),
         toJSON: (self) => self.dataObject.toJSON(),
      },
   })

   const proxy = new ProxyConstructor<typeof model, Proxy<Model<T>>>(model, {
      get: (target, prop) => {
         if (prop === 'uid') {
            return target.uid
         }

         if (prop === 'uri') {
            return target.uri
         }

         if (prop == 'toJSON') {
            return target.toJSON
         }

         //  if (prop == 'save') {
         //     return target.save
         //  }

         if (prop == 'constructor') {
            return target.constructor
         }

         if (prop === 'core') {
            return target
         }

         // i don't know why and i shouldn't have to wonder why
         // but everything crashes unless we do this terribleness
         if (prop == 'then') {
            return
         }

         return target.val(prop as string)
      },
      set(target, prop, newValue) {
         if (prop === 'uid' || prop === 'core') {
            throw new Error(`Property '${prop}' is readonly`)
         }

         target.set(prop as string, newValue)
         return true
      },
   })

   return proxy
}

const User = $model('users', userProps)

const user = User.fromObject({
   name: 'John Doe',
   age: 24,
})
