import { ObjectUri } from './ObjectUri'

describe('Object Uri', () => {
   test('relative uri', () => {
      const uri = new ObjectUri('collection/uid', 'a label')
      //expect(uri.backend).toBe('@default')
      expect(uri.path).toBe('collection/uid')
      //expect(uri.literal).toBe('@default:collection/uid')
      expect(uri.collection).toBe('collection')
      expect(uri.uid).toBe('uid')
      expect(uri.label).toBe('a label')
   })

   test('relative uri with sub collection', () => {
      const uri = new ObjectUri('collection/uid/subcollection/sid', 'a label')
      //expect(uri.backend).toBe('@default')
    //  expect(uri.path).toBe('subcollection/sid')
   //   expect(uri.literal).toBe('@default:collection/uid/subcollection/sid')
      expect(uri.collection).toBe('subcollection')
      expect(uri.uid).toBe('sid')
      expect(uri.label).toBe('a label')
   })

   test('uri with backend', () => {
      const uri = new ObjectUri('@backend:collection/uid', 'a label')
      expect(uri.backend).toBe('@backend')
      expect(uri.path).toBe('collection/uid')
      expect(uri.literal).toBe('@backend:collection/uid')
      expect(uri.collection).toBe('collection')
      expect(uri.uid).toBe('uid')
      expect(uri.label).toBe('a label')
   })

   test('uri represents a subcollections-based path', () => {
      const path = 'collection1/uid1/collection2/uid2/collection3/uid3'
      const uri = new ObjectUri(path, 'a subcollections-based path')
      //expect(uri.backend).toBe('@default')
  //    expect(uri.path).toBe('collection3/uid3')
  //    expect(uri.literal).toBe(`@default:${path}`)
      expect(uri.collection).toBe('collection3')
      expect(uri.uid).toBe('uid3')
      expect(uri.parent).toBeInstanceOf(ObjectUri)
   //   expect(uri.parent?.literal).toBe('@default:collection1/uid1/collection2/uid2')
      expect(uri.parent?.collection).toBe('collection2')
   //   expect(uri.parent?.path).toBe('collection2/uid2')
      expect(uri.parent?.parent).toBeInstanceOf(ObjectUri)
   //   expect(uri.parent?.parent?.literal).toBe('@default:collection1/uid1')
      expect(uri.parent?.parent?.collection).toBe('collection1')
      expect(uri.parent?.parent?.path).toBe('collection1/uid1')
      expect(uri.label).toBe('a subcollections-based path')
   })

   test('uri points to file', () => {
      const uri = new ObjectUri('@s3:path/to/file.ext', 'a file')
      expect(uri.backend).toBe('@s3')
      expect(uri.path).toBe('path/to/file.ext')
      expect(uri.literal).toBe('@s3:path/to/file.ext')
      expect(uri.collection).toBeUndefined()
      expect(uri.uid).toBe('file.ext')
      expect(uri.label).toBe('a file')
   })

   test('uri without collection', () => {
      const uri = new ObjectUri('uid')
   //   expect(uri.backend).toBe('@default')
      expect(uri.path).toBe('uid')
      //expect(uri.literal).toBe(`@default:${ObjectUri.MISSING_COLLECTION}/uid`)
      expect(uri.collection).toBeUndefined()
      expect(uri.uid).toBe('uid')

      uri.collection = 'collection'
      expect(uri.collection).toBe('collection')
   })

   test('exceptions and error boundaries', () => {
      // 1. Odd number of path parts (> 1) and not a file
      expect(() => new ObjectUri('part1/part2/part3')).toThrow("Path parts number must be 1 or even")

      const uri = new ObjectUri('collection/uid')
      
      // 2. class setter/getter
      uri.class = { name: 'MyClass' }
      expect(uri.collection).toBe('myclass')
      expect(uri.class).toEqual({ name: 'MyClass' })

      uri.class = null
      expect(uri.collection).toBeUndefined()

      // 3. ownPath getter
      const parentUri = new ObjectUri('collection1/uid1/collection2/uid2')
      expect(parentUri.ownPath).toBe('collection2/uid2')

      // 4. collection setter exception
      const lockedUri = new ObjectUri('collection/uid')
      expect(() => { lockedUri.collection = 'new-collection' }).toThrow('Collection value already set')

      // 5. toReference and toJSON
      const refUri = new ObjectUri('@s3:collection/uid', 'my label')
      refUri.path = 'collection/uid'
      expect(refUri.toReference()).toEqual({
         ref: 'collection/uid',
         uri: '@s3:collection/uid',
         label: 'my label'
      })

      expect(refUri.toJSON()).toEqual({
         ref: 'collection/uid',
         label: 'my label',
         backend: '@s3'
      })
   })
})

