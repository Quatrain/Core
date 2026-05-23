/**
 * Unique global reference system for all Quatrain models.
 * Used for backend identification and cross-system relational links.
 */
export class ObjectUri {
   /** Root path divider. */
   static DEFAULT = '/'
   /** Placeholder used when collections cannot be guessed. */
   static MISSING_COLLECTION = '_?_'

   protected _str: string
   protected _pairs: Array<string> = []
   protected _literal: string = ''
   protected _backend: string | undefined
   protected _path: string = ObjectUri.DEFAULT
   protected _uid: string | undefined = undefined
   protected _collection: string | undefined = undefined
   protected _label: string | undefined = ''
   protected _objClass: any
   protected _parent: ObjectUri | undefined

   /**
    * create object uri from string:
    * ex: 'xyz', '@backend:xyz', 'collection/xyz', '@backend:collection/xyz'
    * some backends will need a collection or table name, some may deduct it from object
    * @param str partial or full resource path
    * @param label optional label to describe path
    */
   constructor(str: string = '', label: string | undefined = '') {
      this._str = str
      this._label = label
      if (str.includes(':')) {
         const [backend, path] = str.split(':')
         this._backend = backend
         this._path = path
      } else {
         this._path = str
      }
      const parts = this._path.split(ObjectUri.DEFAULT)
      const isFilePath = parts[parts.length - 1].indexOf('.') !== -1

      if (isFilePath) {
         this._uid = parts[parts.length - 1]
      } else if (parts.length === 1) {
         // It is allowed to only give the uid part of the uri
         // provided that collection will be injected by another means
         this._uid = parts[0].length > 0 ? parts[0] : undefined
         this._collection = ObjectUri.MISSING_COLLECTION
         this._pairs.push(
            `${ObjectUri.MISSING_COLLECTION}${ObjectUri.DEFAULT}${this._uid}`
         )
         this._label = label || this._uid
      } else if (parts.length % 2 === 0) {
         this._path = parts.slice(parts.length - 2).join(ObjectUri.DEFAULT)
         this._uid = parts[parts.length - 1]
         this._collection = parts[parts.length - 2]
         if (parts.length > 2) {
            this._parent = new ObjectUri(
               parts.slice(0, parts.length - 2).join(ObjectUri.DEFAULT)
            )
         }
         this._label = label || this._uid
      } else if (!isFilePath) {
         // if the last part is not a filename with extension, throw error
         throw new Error(
            `Path parts number must be 1 or even, received: '${str}'`
         )
      }
   }

   set class(objClass: any) {
      this._objClass = objClass
      if (objClass) {
         this._collection =
            objClass.COLLECTION ||
            (objClass.name && objClass.name.toLowerCase())
      } else {
         this._collection = undefined
      }
   }

   get class() {
      return this._objClass
   }

   get backend() {
      return this._backend
   }

   /**
    * Returns the full path of the resource
    * including optional parents' path
    * @returns string
    */
   get path() {
      return this._parent
         ? `${this._parent.path}${ObjectUri.DEFAULT}${this._path}`
         : this._path
   }

   /**
    * Returns the own path of the resource
    * without the optional parents' paths
    * @returns string
    */
   get ownPath() {
      return this._path
   }

   get parent() {
      return this._parent
   }

   set label(label: string | undefined) {
      this._label = label
   }

   get label() {
      return this._label
   }

   /**
    * Return the full path litteral
    * including the backend alias
    * @returns string
    */
   get literal() {
      return this._str.includes(':')
         ? this._str
         : `${this._backend}:${this._str}`
   }

   set path(path: string) {
      this._path = path
      this._collection = path.split('/')[0]
      this._literal = `${this._backend}:${this._path}`
      this._uid = path.split('/').pop()
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
         ref: this.path,
         uri: this._literal,
         label: this._label,
      }
   }

   /**
    * Output pure object dictionary representation.
    * 
    * @returns Rendered URI block.
    */
   toJSON() {
      const res: any = {
         ref: this.path,
         label: this._label || '',
      }
      if (this._backend !== undefined) {
         res.backend = this._backend
      }
      return res
   }
}
