import { Core } from '../Core'

export class ObjectUri {
   static DEFAULT = '/'
   static MISSING_COLLECTION = '_?_'

   protected _str: string
   protected _pairs: Array<string> = []
   protected _literal: string = ''
   protected _backend: string = Core.defaultBackend
   protected _path: string = ObjectUri.DEFAULT
   protected _uid: string | undefined = undefined
   protected _collection: string | undefined = undefined
   protected _label: string | undefined
   protected _objClass: any

   /**
    * create object uri from string:
    * ex: 'xyz', '@backend:xyz', 'collection/xyz', '@backend:collection/xyz'
    * some backends will need a collection or table name, some may deduct it from object
    * @param str
    */
   constructor(str: string = '', label: string | undefined = undefined) {
      this._str = str
      this._label = label || this._uid
      if (str.indexOf(':') !== -1) {
         const [backend, path] = str.split(':')
         this._backend = backend || Core.defaultBackend
         this._path = path
      } else {
         this._path = str
      }
      const parts = this._path.split(ObjectUri.DEFAULT)
      if (parts.length === 1) {
         // It is allowed to only give the uid part of the uri
         // provided that collection will be injected by another mean
         this._uid = parts[0].length > 0 ? parts[0] : undefined
         this._collection = ObjectUri.MISSING_COLLECTION
         this._pairs.push(
            `${ObjectUri.MISSING_COLLECTION}${ObjectUri.DEFAULT}${this._uid}`
         )
      } else if (parts.length % 2 === 0) {
         // General case is a path containing pairs of collection/uid
         let i = 0
         while (i < parts.length) {
            this._collection = parts[i]
            this._uid = parts[i + 1]
            this._pairs.push(`${parts[i]}${ObjectUri.DEFAULT}${parts[i + 1]}`)
            i += 2
         }
      } else {
         throw new Error('Path parts number must be 1 or even')
      }
   }

   set class(objClass: any) {
      this._objClass = objClass
   }

   get class() {
      return this._objClass
   }

   get backend() {
      return this._backend
   }

   get path() {
      return this._path
   }

   set label(label: string | undefined) {
      this._label = label
   }

   get label() {
      return this._label
   }

   get literal() {
      return `${this._backend}:${this._pairs.join(ObjectUri.DEFAULT)}`
   }

   set path(path: string) {
      if (this._path && this._path !== ObjectUri.DEFAULT) {
         throw new Error(`Path value already set with '${this._path}'`)
      }
      this._path = path
      this._collection = path.split('/').pop()
      this._literal = `${this._backend}:${this._path}`
   }

   get uid() {
      return this._uid
   }

   get collection(): string | undefined {
      return this._collection === ObjectUri.MISSING_COLLECTION
         ? undefined
         : this._collection
   }

   set collection(collection: string | undefined) {
      if (this.collection !== undefined) {
         throw new Error('Collection value already set')
      }
      this._collection = collection
   }

   /**
    * Return references to find object locally and remotely
    * @returns object
    */
   toReference() {
      return {
         ref: this._path,
         uri: this._literal,
         label: this._label,
      }
   }

   toJSON() {
      return {
         backend: this._backend,
         ref: this._path,
         label: this._label,
      }
   }
}
