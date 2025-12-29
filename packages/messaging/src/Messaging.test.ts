import { Messaging, MessagingParameters } from './Messaging'
import { MockMessagingAdapter } from './MockMessagingAdapter'
import { MessagingRecipient } from './types/MessagingRecipient'
import { NotificationMessage } from './types/NotificationMessage'

describe('Messaging', () => {
   let mockAdapter1: MockMessagingAdapter
   let mockAdapter2: MockMessagingAdapter

   beforeEach(() => {
      // Reset messagers before each test
      ;(Messaging as any)._messagers = {}
      Messaging.defaultMessager = 'default'

      // Create fresh mock adapters
      mockAdapter1 = new MockMessagingAdapter({ debug: false })
      mockAdapter2 = new MockMessagingAdapter({ debug: false })
   })

   afterEach(() => {
      // Clean up
      mockAdapter1?.clearMessages()
      mockAdapter2?.clearMessages()
   })

   describe('addMessager', () => {
      it('should add a messager with an alias', () => {
         Messaging.addMessager(mockAdapter1, 'test-messager')

         const messager = Messaging.getMessager('test-messager')
         expect(messager).toBe(mockAdapter1)
      })

      it('should add multiple messagers with different aliases', () => {
         Messaging.addMessager(mockAdapter1, 'messager1')
         Messaging.addMessager(mockAdapter2, 'messager2')

         const messager1 = Messaging.getMessager('messager1')
         const messager2 = Messaging.getMessager('messager2')

         expect(messager1).toBe(mockAdapter1)
         expect(messager2).toBe(mockAdapter2)
      })

      it('should set default messager when setDefault is true', () => {
         Messaging.addMessager(mockAdapter1, 'custom-messager', true)

         expect(Messaging.defaultMessager).toBe('custom-messager')
         const messager = Messaging.getMessager() // Should use default
         expect(messager).toBe(mockAdapter1)
      })

      it('should not change default messager when setDefault is false', () => {
         const originalDefault = Messaging.defaultMessager
         Messaging.addMessager(mockAdapter1, 'custom-messager', false)

         expect(Messaging.defaultMessager).toBe(originalDefault)
      })

      it('should allow overriding an existing messager', () => {
         Messaging.addMessager(mockAdapter1, 'messager')
         Messaging.addMessager(mockAdapter2, 'messager')

         const messager = Messaging.getMessager('messager')
         expect(messager).toBe(mockAdapter2)
      })
   })

   describe('getMessager', () => {
      it('should return the correct messager by alias', () => {
         Messaging.addMessager(mockAdapter1, 'test-messager')

         const messager = Messaging.getMessager('test-messager')
         expect(messager).toBe(mockAdapter1)
      })

      it('should return the default messager when no alias is specified', () => {
         Messaging.addMessager(mockAdapter1, 'default', true)

         const messager = Messaging.getMessager()
         expect(messager).toBe(mockAdapter1)
      })

      it('should throw error when messager alias does not exist', () => {
         expect(() => {
            Messaging.getMessager('non-existent')
         }).toThrow("Unknown messager alias: 'non-existent'")
      })

      it('should throw error when getting default messager that does not exist', () => {
         expect(() => {
            Messaging.getMessager()
         }).toThrow("Unknown messager alias: 'default'")
      })
   })

   describe('defaultMessager property', () => {
      it('should have a default value of "default"', () => {
         expect(Messaging.defaultMessager).toBe('default')
      })

      it('should allow changing the default messager', () => {
         Messaging.addMessager(mockAdapter1, 'new-default', true)
         expect(Messaging.defaultMessager).toBe('new-default')
      })
   })

   describe('Integration with MockMessagingAdapter - Notifications', () => {
      const recipient: MessagingRecipient = {
         firstname: 'John',
         lastname: 'Doe',
         email: 'john@example.com',
         messageToken: 'test-token-123',
      }

      const message: NotificationMessage = {
         title: 'Test Notification',
         body: 'This is a test',
      }

      it('should send single notification', async () => {
         Messaging.addMessager(mockAdapter1, 'test')
         const messager = Messaging.getMessager('test') as MockMessagingAdapter

         const result = await messager.sendNotification(recipient, message)

         expect(result.success).toBe(true)
         expect(result.messageId).toMatch(/^notif-/)
         expect(messager.getMessageCount('notification')).toBe(1)
      })

      it('should send batch notifications', async () => {
         Messaging.addMessager(mockAdapter1, 'test')
         const messager = Messaging.getMessager('test') as MockMessagingAdapter

         const recipients = [
            recipient,
            { ...recipient, email: 'jane@example.com' },
         ]
         const result = await messager.sendNotifications(recipients, message)

         expect(result.success).toBe(true)
         expect(result.count).toBe(2)
         expect(messager.getMessageCount('notification')).toBe(1) // One batch
      })
   })

   describe('Integration with MockMessagingAdapter - Emails', () => {
      const recipient: MessagingRecipient = {
         firstname: 'John',
         lastname: 'Doe',
         email: 'john@example.com',
         messageToken: 'test-token-123',
      }

      const message: NotificationMessage = {
         title: 'Test Email',
         body: 'This is a test email',
      }

      it('should send single email', async () => {
         Messaging.addMessager(mockAdapter1, 'test')
         const messager = Messaging.getMessager('test') as MockMessagingAdapter

         const result = await messager.sendEmail(recipient, message)

         expect(result.success).toBe(true)
         expect(result.messageId).toMatch(/^email-/)
         expect(messager.getMessageCount('email')).toBe(1)
      })

      it('should send batch emails', async () => {
         Messaging.addMessager(mockAdapter1, 'test')
         const messager = Messaging.getMessager('test') as MockMessagingAdapter

         const recipients = [
            recipient,
            { ...recipient, email: 'jane@example.com' },
         ]
         const result = await messager.sendEmails(recipients, message)

         expect(result.success).toBe(true)
         expect(result.count).toBe(2)
         expect(messager.getMessageCount('email')).toBe(1) // One batch
      })
   })

   describe('Integration with MockMessagingAdapter - Text Messages', () => {
      const recipient: MessagingRecipient = {
         firstname: 'John',
         lastname: 'Doe',
         email: 'john@example.com',
         messageToken: 'test-token-123',
      }

      const message: NotificationMessage = {
         title: 'Test SMS',
         body: 'This is a test SMS',
      }

      it('should send single text message', async () => {
         Messaging.addMessager(mockAdapter1, 'test')
         const messager = Messaging.getMessager('test') as MockMessagingAdapter

         const result = await messager.sendTextMessage(recipient, message)

         expect(result.success).toBe(true)
         expect(result.messageId).toMatch(/^text-/)
         expect(messager.getMessageCount('text')).toBe(1)
      })

      it('should send batch text messages', async () => {
         Messaging.addMessager(mockAdapter1, 'test')
         const messager = Messaging.getMessager('test') as MockMessagingAdapter

         const recipients = [
            recipient,
            { ...recipient, email: 'jane@example.com' },
         ]
         const result = await messager.sendTextMessages(recipients, message)

         expect(result.success).toBe(true)
         expect(result.count).toBe(2)
         expect(messager.getMessageCount('text')).toBe(1) // One batch
      })
   })

   describe('Integration - Multiple message types', () => {
      it('should maintain separate state between messagers', async () => {
         Messaging.addMessager(mockAdapter1, 'messager1')
         Messaging.addMessager(mockAdapter2, 'messager2')

         const adapter1 = Messaging.getMessager(
            'messager1'
         ) as MockMessagingAdapter
         const adapter2 = Messaging.getMessager(
            'messager2'
         ) as MockMessagingAdapter

         const recipient: MessagingRecipient = {
            firstname: 'Test',
            lastname: 'User',
            email: 'test@example.com',
            messageToken: 'test-token-123',
         }

         const message: NotificationMessage = {
            title: 'Test',
            body: 'Test message',
         }

         await adapter1.sendNotification(recipient, message)
         await adapter2.sendEmail(recipient, message)

         expect(adapter1.getMessageCount('notification')).toBe(1)
         expect(adapter1.getMessageCount('email')).toBe(0)

         expect(adapter2.getMessageCount('email')).toBe(1)
         expect(adapter2.getMessageCount('notification')).toBe(0)
      })

      it('should track different message types', async () => {
         Messaging.addMessager(mockAdapter1, 'test')
         const messager = Messaging.getMessager('test') as MockMessagingAdapter

         const recipient: MessagingRecipient = {
            firstname: 'Test',
            lastname: 'User',
            email: 'test@example.com',
            messageToken: 'test-token-123',
         }

         const message: NotificationMessage = {
            title: 'Test',
            body: 'Test message',
         }

         await messager.sendNotification(recipient, message)
         await messager.sendEmail(recipient, message)
         await messager.sendTextMessage(recipient, message)

         expect(messager.getMessageCount()).toBe(3)
         expect(messager.getMessageCount('notification')).toBe(1)
         expect(messager.getMessageCount('email')).toBe(1)
         expect(messager.getMessageCount('text')).toBe(1)
      })
   })

   describe('Messaging registry behavior', () => {
      it('should maintain messagers across multiple operations', () => {
         Messaging.addMessager(mockAdapter1, 'persistent')

         // Multiple get operations
         const messager1 = Messaging.getMessager('persistent')
         const messager2 = Messaging.getMessager('persistent')

         expect(messager1).toBe(messager2)
         expect(messager1).toBe(mockAdapter1)
      })

      it('should handle switching default messager multiple times', () => {
         Messaging.addMessager(mockAdapter1, 'messager1', true)
         expect(Messaging.defaultMessager).toBe('messager1')

         Messaging.addMessager(mockAdapter2, 'messager2', true)
         expect(Messaging.defaultMessager).toBe('messager2')

         const defaultMessager = Messaging.getMessager()
         expect(defaultMessager).toBe(mockAdapter2)
      })
   })

   describe('logger', () => {
      it('should have a logger instance', () => {
         expect(Messaging.logger).toBeDefined()
      })
   })
})
