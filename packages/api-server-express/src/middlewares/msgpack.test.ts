import { Request, Response } from 'express'
import { decode, encode } from '@msgpack/msgpack'
import { ObjectUri } from '@quatrain/core'
import {
   MSGPACK_CONTENT_TYPE,
   isMsgpackRequested,
   msgpackContentNegotiation,
   normalizeForMsgpack,
} from './msgpack'

const mockRequest = (props: Partial<Request> = {}): Request =>
   ({ query: {}, headers: {}, ...props } as unknown as Request)

const mockResponse = () => {
   const state: { headers: Record<string, string>; sent: unknown; status: number } = {
      headers: {},
      sent: undefined,
      status: 200,
   }
   const res = {
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
   } as unknown as Response
   return { res, state }
}

describe('MessagePack content negotiation', () => {
   describe('isMsgpackRequested()', () => {
      it('detects the Accept header and the format query parameter', () => {
         expect(isMsgpackRequested(mockRequest({ headers: { accept: 'application/x-msgpack' } }))).toBe(true)
         expect(isMsgpackRequested(mockRequest({ headers: { accept: 'application/msgpack' } }))).toBe(true)
         expect(isMsgpackRequested(mockRequest({ query: { format: 'msgpack' } } as any))).toBe(true)
         expect(isMsgpackRequested(mockRequest({ headers: { accept: 'application/json' } }))).toBe(false)
      })
   })

   describe('normalizeForMsgpack()', () => {
      it('serializes ObjectUri instances via toMsgPack() with path instead of ref', () => {
         const company = new ObjectUri('companies/c1', 'TotalYmage SAS')

         expect(normalizeForMsgpack({ company })).toEqual({
            company: { path: 'companies/c1', label: 'TotalYmage SAS' },
         })
      })

      it('renames ref to path on references already serialized via toJSON()', () => {
         expect(
            normalizeForMsgpack({
               company: { ref: 'companies/c1', label: 'TotalYmage SAS' },
               createdBy: { ref: 'users/u1', label: 'Alice', backend: '@pg' },
               owner: { ref: 'users/u2', uri: 'users/u2', label: 'Bob' },
            })
         ).toEqual({
            company: { path: 'companies/c1', label: 'TotalYmage SAS' },
            createdBy: { path: 'users/u1', label: 'Alice', backend: '@pg' },
            owner: { path: 'users/u2', uri: 'users/u2', label: 'Bob' },
         })
      })

      it('leaves business objects with a ref field and other keys untouched', () => {
         const order = { ref: 'ORD-42', label: 'Order', amount: 10 }

         expect(normalizeForMsgpack(order)).toEqual(order)
      })

      it('omits null and undefined values, in objects and arrays', () => {
         expect(
            normalizeForMsgpack({ name: 'x', empty: null, missing: undefined, nested: { keep: 1, drop: null } })
         ).toEqual({ name: 'x', nested: { keep: 1 } })
         expect(normalizeForMsgpack([1, null, 2, undefined, 3])).toEqual([1, 2, 3])
      })

      it('omits circular references', () => {
         const node: Record<string, unknown> = { name: 'root' }
         node.self = node

         expect(normalizeForMsgpack(node)).toEqual({ name: 'root' })
      })

      it('converts dates via toJSON() and preserves binary values', () => {
         const bin = new Uint8Array([1, 2, 3])
         const normalized = normalizeForMsgpack({
            at: new Date('2026-11-09T18:49:23.823Z'),
            bin,
         }) as Record<string, unknown>

         expect(normalized.at).toBe('2026-11-09T18:49:23.823Z')
         expect(normalized.bin).toBe(bin)
      })
   })

   describe('msgpackContentNegotiation', () => {
      it('decodes MessagePack request bodies', () => {
         const req = mockRequest({
            headers: { 'content-type': MSGPACK_CONTENT_TYPE },
            body: Buffer.from(encode({ name: 'hello' })),
         })
         const { res } = mockResponse()
         const next = jest.fn()

         msgpackContentNegotiation(req, res, next)

         expect(req.body).toEqual({ name: 'hello' })
         expect(next).toHaveBeenCalled()
      })

      it('answers 400 on malformed MessagePack bodies', () => {
         const req = mockRequest({
            headers: { 'content-type': MSGPACK_CONTENT_TYPE },
            body: Buffer.from([0xc1]),
         })
         const { res, state } = mockResponse()
         const next = jest.fn()

         msgpackContentNegotiation(req, res, next)

         expect(state.status).toBe(400)
         expect(next).not.toHaveBeenCalled()
      })

      it('encodes res.send() and res.json() payloads when MessagePack is requested', () => {
         for (const method of ['send', 'json'] as const) {
            const req = mockRequest({ headers: { accept: MSGPACK_CONTENT_TYPE } })
            const { res, state } = mockResponse()

            msgpackContentNegotiation(req, res, () => {})
            res[method]({
               items: [{ uid: 'v1', company: { ref: 'companies/c1', label: 'TotalYmage SAS' }, empty: null }],
            })

            expect(state.headers['content-type']).toBe(MSGPACK_CONTENT_TYPE)
            expect(decode(state.sent as Buffer)).toEqual({
               items: [{ uid: 'v1', company: { path: 'companies/c1', label: 'TotalYmage SAS' } }],
            })
         }
      })

      it('leaves JSON responses untouched when MessagePack is not requested', () => {
         const req = mockRequest({ headers: { accept: 'application/json' } })
         const { res, state } = mockResponse()
         const payload = { company: { ref: 'companies/c1', label: 'TotalYmage SAS' } }

         msgpackContentNegotiation(req, res, () => {})
         res.json(payload)

         expect(state.sent).toBe(payload)
      })
   })
})
