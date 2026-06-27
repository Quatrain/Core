/**
 * Unique global reference system for all Quatrain models.
 * Used for backend identification and cross-system relational links.
 */
export class ObjectUri {
   /** Root path divider. */
   static DEFAULT = '/'
   /** Placeholder used when collections cannot be guessed. */
   static MISSING_COLLECTION = '_?_'

   /** Internal string representation. */
   protected _str: string
   /** Split pairs of path segments. */
   protected _pairs: Array<string> = []
   /** The literal representation including backend name. */
   protected _literal: string = ''
   /** Target backend identifier. */
   protected _backend: string | undefined
   /** Standardized path. */
   protected _path: string = ObjectUri.DEFAULT
   /** Unique resource ID. */
   protected _uid: string | undefined = undefined
   /** Collection name context. */
   protected _collection: string | undefined = undefined
   /** Human-readable label representation. */
   protected _label: string | undefined = ''
   /** Object model class reference. */
   protected _objClass: any
   /** Parent ObjectUri context. */
   protected _parent: ObjectUri | undefined

   /**
    * Creates a new ObjectUri instance from a path string.
    * ex: 'xyz', '@backend:xyz', 'collection/xyz', '@backend:collection/xyz'
    * 
    * @param str - Partial or full resource path.
    * @param label - Optional label describing the resource path.
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

   /**
    * Binds a model class reference to resolve collection details.
    * 
    * @param objClass - The model constructor class.
    */
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

   /**
    * Retrieves the model class bound to the URI.
    * 
    * @returns The model class reference.
    */
   get class() {
      return this._objClass
   }

   /**
    * Retrieves the target backend alias.
    * 
    * @returns The backend identifier, or undefined if not set.
    */
   get backend() {
      return this._backend
   }

   /**
    * Returns the full path of the resource, including optional parents' paths.
    * 
    * @returns The computed path string.
    */
   get path() {
      return this._parent
         ? `${this._parent.path}${ObjectUri.DEFAULT}${this._path}`
         : this._path
   }

   /**
    * Returns the own path of the resource without the optional parents' paths.
    * 
    * @returns The own path segment string.
    */
   get ownPath() {
      return this._path
   }

   /**
    * Retrieves the parent ObjectUri context.
    * 
    * @returns The parent ObjectUri reference, or undefined.
    */
   get parent() {
      return this._parent
   }

   /**
    * Sets the human-readable label representation.
    * 
    * @param label - The descriptive string label.
    */
   set label(label: string | undefined) {
      this._label = label
   }

   /**
    * Retrieves the human-readable label representation.
    * 
    * @returns The descriptive label, or undefined.
    */
   get label() {
      return this._label
   }

   /**
    * Return the full path literal, including the backend alias.
    * 
    * @returns The fully qualified URI literal.
    */
   get literal() {
      return this._str.includes(':')
         ? this._str
         : `${this._backend}:${this._str}`
   }

   /**
    * Overwrites the path and automatically recalculates collection details.
    * 
    * @param path - The new relative path segment.
    */
   set path(path: string) {
      this._path = path
      this._collection = path.split('/')[0]
      this._literal = `${this._backend}:${this._path}`
      this._uid = path.split('/').pop()
   }

   /**
    * Retrieves the unique identifier of the resource.
    * 
    * @returns The unique ID string.
    */
   get uid() {
      return this._uid
   }

   /**
    * Retrieves the collection or table name context.
    * 
    * @returns The collection name, or undefined.
    */
   get collection(): string | undefined {
      return this._collection === ObjectUri.MISSING_COLLECTION
         ? undefined
         : this._collection
   }

   /**
    * Injects a specific collection or table context name.
    * 
    * @param collection - The target collection name.
    */
   set collection(collection: string | undefined) {
      if (this.collection !== undefined) {
         throw new Error('Collection value already set')
      }
      this._collection = collection
   }

   /**
    * Returns references to locate the target object locally and remotely.
    * 
    * @returns An object detailing path, uri literal, and label.
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
    * @returns Rendered JSON-like URI block representation.
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
