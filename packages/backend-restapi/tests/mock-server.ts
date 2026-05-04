const express = require('express')

const app = express()
app.use(express.json())

// Mock database
let items = [
   { uid: '1', name: 'Item 1' },
   { uid: '2', name: 'Item 2' }
]

// Unprotected endpoint
app.get('/api/public/items', (req, res) => {
   let result = items
   if (req.query.name) {
      result = items.filter(i => i.name === req.query.name)
   }
   res.json({ data: result, meta: { total: result.length } })
})

app.post('/api/public/items', (req, res) => {
   res.status(405).json({ error: 'Method Not Allowed' })
})

// Protected endpoint
app.use('/api/protected/*', (req, res, next) => {
   const auth = req.headers.authorization
   if (!auth || (!auth.startsWith('Basic ') && !auth.startsWith('Bearer '))) {
      return res.status(401).json({ error: 'Unauthorized' })
   }
   next()
})

app.get('/api/protected/items', (req, res) => {
   res.json({ data: items, meta: { total: items.length } })
})

app.post('/api/protected/items', (req, res) => {
   const newItem = { uid: String(items.length + 1), ...req.body }
   items.push(newItem)
   res.status(201).json({ data: newItem })
})

// Return the server instance for tests to close
export function startMockServer(port: number = 3001) {
   return new Promise<any>((resolve) => {
      const server = app.listen(port, () => resolve(server))
   })
}
