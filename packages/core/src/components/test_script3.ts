import { ObjectUri } from './ObjectUri'
const uri = new ObjectUri()
uri.path = 'test_collection/12345'
console.log('--- PATH ---', uri.path)
console.log('--- URI ---', uri)
