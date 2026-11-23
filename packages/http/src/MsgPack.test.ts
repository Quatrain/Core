import { decode, encode } from '@msgpack/msgpack'
import {
   MSGPACK_CONTENT_TYPE,
   MsgPackRequest,
   MsgPackResponse,
   encodeMsgPack,
   isMsgPackRequested,
   msgPackContentNegotiation,
} from './MsgPack'

const mockRequest = (props: Partial<MsgPackRequest> = {}): MsgPackRequest => ({
   query: {},
   headers: {},
   ...props,
})

const mockResponse = () => {
   const state: { headers: Record<string, string>; sent: unknown; status: number } = {
      headers: {},
      sent: undefined,
      status: 200,
   }
   const res: MsgPackResponse = {
      setHeader(name: string, value: string) {
         state.headers[name.toLowerCase()] = value
      },
      status(code: number) {
         state.status = code
         return this
      },
      json(data: unknown) {
         state.sent = data
         return this
      },
      send(data: unknown) {
         state.sent = data
         return this
      },
   }
   return { res, state }
}

describe('MessagePack content negotiation', () => {
   describe('isMsgPackRequested()', () => {
      it('detects the Accept header, whatever its case', () => {
         expect(isMsgPackRequested(mockRequest({ headers: { accept: 'application/x-msgpack' } }))).toBe(true)
         expect(isMsgPackRequested(mockRequest({ headers: { accept: 'application/msgpack' } }))).toBe(true)
         expect(isMsgPackRequested(mockRequest({ headers: { accept: 'Application/X-MsgPack' } }))).toBe(true)
         expect(
            isMsgPackRequested(mockRequest({ headers: { accept: 'application/json, application/x-msgpack;q=0.9' } }))
         ).toBe(true)
         expect(isMsgPackRequested(mockRequest({ headers: { accept: 'application/json' } }))).toBe(false)
         expect(isMsgPackRequested(mockRequest())).toBe(false)
      })

      it('detects the format query parameter', () => {
         expect(isMsgPackRequested(mockRequest({ query: { format: 'msgpack' } }))).toBe(true)
         expect(isMsgPackRequested(mockRequest({ query: { format: ['MsgPack', 'json'] } }))).toBe(true)
         expect(isMsgPackRequested(mockRequest({ query: { format: 'json' } }))).toBe(false)
      })
   })

   describe('encodeMsgPack()', () => {
      it('applies the MessagePack wire contract before encoding', () => {
         const buffer = encodeMsgPack({
            uid: 'v1',
            company: { ref: 'companies/c1', label: 'Acme' },
            empty: null,
         })

         expect(Buffer.isBuffer(buffer)).toBe(true)
         expect(decode(buffer)).toEqual({ uid: 'v1', company: { path: 'companies/c1', label: 'Acme' } })
      })
   })

   describe('msgPackContentNegotiation()', () => {
      it('decodes MessagePack request bodies', () => {
         const req = mockRequest({
            headers: { 'content-type': MSGPACK_CONTENT_TYPE },
            body: Buffer.from(encode({ name: 'hello' })),
         })
         const { res } = mockResponse()
         const next = jest.fn()

         msgPackContentNegotiation()(req, res, next)

         expect(req.body).toEqual({ name: 'hello' })
         expect(next).toHaveBeenCalled()
      })

      it('decodes an empty MessagePack request body as an empty object', () => {
         const req = mockRequest({
            headers: { 'content-type': MSGPACK_CONTENT_TYPE },
            body: Buffer.alloc(0),
         })
         const { res } = mockResponse()

         msgPackContentNegotiation()(req, res, () => {})

         expect(req.body).toEqual({})
      })

      it('answers 400 on malformed MessagePack bodies', () => {
         const req = mockRequest({
            headers: { 'content-type': MSGPACK_CONTENT_TYPE },
            body: Buffer.from([0xc1]),
         })
         const { res, state } = mockResponse()
         const next = jest.fn()

         msgPackContentNegotiation()(req, res, next)

         expect(state.status).toBe(400)
         expect(next).not.toHaveBeenCalled()
      })

      it('encodes res.send() and res.json() payloads when MessagePack is requested', () => {
         for (const method of ['send', 'json'] as const) {
            const req = mockRequest({ headers: { accept: MSGPACK_CONTENT_TYPE } })
            const { res, state } = mockResponse()

            msgPackContentNegotiation()(req, res, () => {})
            res[method]({
               items: [{ uid: 'v1', company: { ref: 'companies/c1', label: 'Acme' }, empty: null }],
            })

            expect(state.headers['content-type']).toBe(MSGPACK_CONTENT_TYPE)
            expect(decode(state.sent as Buffer)).toEqual({
               items: [{ uid: 'v1', company: { path: 'companies/c1', label: 'Acme' } }],
            })
         }
      })

      it('sends strings and buffers untouched through res.send()', () => {
         const req = mockRequest({ headers: { accept: MSGPACK_CONTENT_TYPE } })
         const { res, state } = mockResponse()
         const binary = Buffer.from([1, 2, 3])

         msgPackContentNegotiation()(req, res, () => {})

         res.send('plain text')
         expect(state.sent).toBe('plain text')
         res.send(binary)
         expect(state.sent).toBe(binary)
         expect(state.headers['content-type']).toBeUndefined()
      })

      it('answers 500 in JSON when the payload cannot be serialized', () => {
         const req = mockRequest({ headers: { accept: MSGPACK_CONTENT_TYPE } })
         const { res, state } = mockResponse()
         const failing = {
            toMsgPack: () => {
               throw new Error('boom')
            },
         }

         msgPackContentNegotiation()(req, res, () => {})
         res.json(failing)

         expect(state.status).toBe(500)
         expect(state.headers['content-type']).toBeUndefined()
         expect(state.sent).toEqual({ error: 'Failed to serialize MessagePack response: boom' })
      })

      it('keeps ref keys when refAsPath is turned off', () => {
         const req = mockRequest({ headers: { accept: MSGPACK_CONTENT_TYPE } })
         const { res, state } = mockResponse()

         msgPackContentNegotiation({ refAsPath: false })(req, res, () => {})
         res.json({ company: { ref: 'companies/c1', label: 'Acme' }, empty: null })

         expect(decode(state.sent as Buffer)).toEqual({ company: { ref: 'companies/c1', label: 'Acme' } })
      })

      it('leaves JSON responses untouched when MessagePack is not requested', () => {
         const req = mockRequest({ headers: { accept: 'application/json' } })
         const { res, state } = mockResponse()
         const payload = { company: { ref: 'companies/c1', label: 'Acme' } }

         msgPackContentNegotiation()(req, res, () => {})
         res.json(payload)

         expect(state.sent).toBe(payload)
      })
   })
})
