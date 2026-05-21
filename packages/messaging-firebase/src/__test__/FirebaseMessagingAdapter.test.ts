import { FirebaseMessagingAdapter } from '../FirebaseMessagingAdapter'
import { MessagingRecipient, NotificationMessage } from '@quatrain/messaging'

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => ({
   credential: {
      cert: jest.fn(() => ({})),
   },
}))

jest.mock('firebase-admin/app', () => ({
   getApps: jest.fn(() => []),
   initializeApp: jest.fn()
}))

jest.mock('firebase-admin/messaging', () => ({
   getMessaging: jest.fn(() => ({
      send: jest.fn().mockResolvedValue('message-id-123'),
      sendMulticast: jest.fn().mockResolvedValue({
         successCount: 2,
         failureCount: 0,
         responses: [
            { success: true, messageId: 'msg-1' },
            { success: true, messageId: 'msg-2' }
         ]
      })
   }))
}))

describe('FirebaseMessagingAdapter', () => {
   let adapter: FirebaseMessagingAdapter
   const mockConfig = {
      projectId: 'test-project',
      privateKey: 'mock-private-key',
      clientEmail: 'test@test.com'
   }

   beforeEach(() => {
      jest.clearAllMocks()
      adapter = new FirebaseMessagingAdapter({
         config: mockConfig
      })
   })

   describe('constructor', () => {
      test('should initialize with config', () => {
         expect(adapter).toBeInstanceOf(FirebaseMessagingAdapter)
      })

      test('should throw error without config', () => {
         expect(() => {
            new FirebaseMessagingAdapter({})
         }).toThrow('Firebase config is required')
      })
   })

   describe('sendNotification', () => {
      const mockRecipient: MessagingRecipient = {
         firstname: 'John',
         lastname: 'Doe',
         email: 'john@example.com',
         messageToken: 'mock-token-123'
      }

      const mockMessage: NotificationMessage = {
         title: 'Test Notification',
         body: 'This is a test message',
         data: { userId: '123', action: 'test' }
      }

      test('should send notification successfully', async () => {
         const result = await adapter.sendNotification(mockRecipient, mockMessage)
         expect(result).toBe('message-id-123')
      })

      test('should throw error when recipient has no message token', async () => {
         const recipientWithoutToken = { ...mockRecipient, messageToken: undefined }
         
         await expect(
            adapter.sendNotification(recipientWithoutToken, mockMessage)
         ).rejects.toThrow('Recipient message token is required')
      })

      test('should use message token from message if provided', async () => {
         const messageWithToken = { ...mockMessage, token: 'custom-token' }
         
         const result = await adapter.sendNotification(mockRecipient, messageWithToken)
         expect(result).toBe('message-id-123')
      })

      test('should handle empty body gracefully', async () => {
         const messageWithoutBody = { ...mockMessage, body: undefined }
         
         const result = await adapter.sendNotification(mockRecipient, messageWithoutBody)
         expect(result).toBe('message-id-123')
      })
   })

    describe('sendNotifications', () => {
      const mockRecipients: MessagingRecipient[] = [
         {
            firstname: 'John',
            lastname: 'Doe',
            email: 'john@example.com',
            messageToken: 'token-1'
         },
         {
            firstname: 'Jane',
            lastname: 'Smith',
            email: 'jane@example.com',
            messageToken: 'token-2'
         }
      ]

      const mockMessage: NotificationMessage = {
         title: 'Multicast Test',
         body: 'This is a multicast message'
      }

      test('should send multicast notification successfully', async () => {
         const result = await adapter.sendNotifications(mockRecipients, mockMessage)
         
         expect(result.successCount).toBe(2)
         expect(result.failureCount).toBe(0)
         expect(result.responses).toHaveLength(2)
      })

      test('should filter out recipients without tokens', async () => {
         const recipientsWithMissingTokens = [
            ...mockRecipients,
            {
               firstname: 'Bob',
               lastname: 'Wilson',
               email: 'bob@example.com',
               messageToken: undefined
            }
         ]

         const result = await adapter.sendNotifications(recipientsWithMissingTokens, mockMessage)
         expect(result.successCount).toBe(2)
      })

      test('should throw error when no valid tokens found', async () => {
         const recipientsWithoutTokens = mockRecipients.map(r => ({ 
            ...r, 
            messageToken: undefined 
         }))

         await expect(
            adapter.sendNotifications(recipientsWithoutTokens, mockMessage)
         ).rejects.toThrow('No valid message tokens found')
      })
   })

   describe('_serializeData', () => {
      test('should serialize complex data correctly', () => {
         const adapter = new FirebaseMessagingAdapter({ config: mockConfig })
         const testData = {
            stringValue: 'test',
            numberValue: 123,
            booleanValue: true,
            objectValue: { nested: 'object' },
            arrayValue: [1, 2, 3]
         }

         const result = (adapter as any)._serializeData(testData)

         expect(result.stringValue).toBe('test')
         expect(result.numberValue).toBe('123')
         expect(result.booleanValue).toBe('true')
         expect(result.objectValue).toBe('{"nested":"object"}')
         expect(result.arrayValue).toBe('[1,2,3]')
      })

      test('should handle empty data', () => {
         const adapter = new FirebaseMessagingAdapter({ config: mockConfig })
         const result = (adapter as any)._serializeData({})
         expect(result).toEqual({})
      })
   })
})