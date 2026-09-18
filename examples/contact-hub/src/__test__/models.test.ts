import { ObjectUri, ValidationError, statuses } from '@quatrain/core'
import { Contact, TaskItem } from '../models'

describe('Sovereign Contact & Task Hub - Domain Models (#32)', () => {
   describe('Contact Model', () => {
      it('should instantiate an in-memory Contact with all valid properties', async () => {
         const contact = await Contact.factory({
            name: 'Ada Lovelace',
            email: 'ada@analytical-engine.org',
            company: 'Babbage Analytics',
            notes: 'First computer programmer',
         })

         expect(contact).toBeInstanceOf(Contact)
         expect(contact.val('name')).toBe('Ada Lovelace')
         expect(contact.val('email')).toBe('ada@analytical-engine.org')
         expect(contact.val('company')).toBe('Babbage Analytics')
         expect(contact.val('notes')).toBe('First computer programmer')
         expect(contact.val('status')).toBe(statuses.CREATED)
         expect(Contact.COLLECTION).toBe('contacts')
      })

      it('should validate successfully when all required fields and formats are valid', async () => {
         const contact = await Contact.factory({
            name: 'Alan Turing',
            email: 'alan.turing@bletchley.ac.uk',
         })

         expect(() => contact.validate()).not.toThrow()
      })

      it('should throw ValidationError when mandatory name is missing or empty', async () => {
         const contact = await Contact.factory({
            email: 'anonymous@example.com',
         })

         expect(() => contact.validate()).toThrow(ValidationError)
         try {
            contact.validate()
         } catch (err: any) {
            expect(err).toBeInstanceOf(ValidationError)
            expect(err.errors).toHaveProperty('name')
            expect(err.errors.name).toMatch(/required/i)
         }
      })

      it('should throw ValidationError when email format is invalid', async () => {
         const contact = await Contact.factory({
            name: 'Grace Hopper',
            email: 'invalid-email-address',
         })

         expect(() => contact.validate()).toThrow(ValidationError)
         try {
            contact.validate()
         } catch (err: any) {
            expect(err).toBeInstanceOf(ValidationError)
            expect(err.errors).toHaveProperty('email')
            expect(err.errors.email).toMatch(/invalid email format/i)
         }
      })

      it('should serialize Contact data correctly to JSON', async () => {
         const contact = await Contact.factory({
            name: 'Margaret Hamilton',
            email: 'margaret@apollo.mit.edu',
            company: 'MIT Instrumentation Lab',
            notes: 'Apollo flight software director',
         })

         const json = contact.dataObject.toJSON()
         expect(json.name).toBe('Margaret Hamilton')
         expect(json.email).toBe('margaret@apollo.mit.edu')
         expect(json.company).toBe('MIT Instrumentation Lab')
         expect(json.notes).toBe('Apollo flight software director')
      })
   })

   describe('TaskItem Model', () => {
      it('should instantiate an in-memory TaskItem with default isCompleted=false', async () => {
         const dueDate = new Date('2026-10-01T09:00:00.000Z')
         const task = await TaskItem.factory({
            title: 'Prepare Apollo 11 checklist',
            dueDate: dueDate.toISOString(),
         })

         expect(task).toBeInstanceOf(TaskItem)
         expect(task.val('title')).toBe('Prepare Apollo 11 checklist')
         expect(task.val('isCompleted')).toBe(false)
         expect(task.val('dueDate')).toBeDefined()
         expect(TaskItem.COLLECTION).toBe('tasks')
         expect(TaskItem.LABEL_KEY).toBe('title')
      })

      it('should validate successfully when title is provided', async () => {
         const task = await TaskItem.factory({
            title: 'Verify AGC source code',
         })

         expect(() => task.validate()).not.toThrow()
      })

      it('should throw ValidationError when mandatory title is missing', async () => {
         const task = await TaskItem.factory({
            isCompleted: true,
         })

         expect(() => task.validate()).toThrow(ValidationError)
         try {
            task.validate()
         } catch (err: any) {
            expect(err).toBeInstanceOf(ValidationError)
            expect(err.errors).toHaveProperty('title')
            expect(err.errors.title).toMatch(/required/i)
         }
      })

      it('should toggle isCompleted flag correctly', async () => {
         const task = await TaskItem.factory({
            title: 'Write integration tests',
         })

         expect(task.val('isCompleted')).toBe(false)
         task.set('isCompleted', true)
         expect(task.val('isCompleted')).toBe(true)
      })

      it('should associate a TaskItem to a Contact via ObjectUri', async () => {
         const contactUri = new ObjectUri('contacts/contact-42', 'Ada Lovelace')
         const task = await TaskItem.factory({
            title: 'Review algorithm for Bernoulli numbers',
         })

         task.set('contact', contactUri)
         expect(task.val('contact')).toBe(contactUri)
      })

      it('should associate a TaskItem to a Contact via Contact instance', async () => {
         const contact = await Contact.factory({
            name: 'Charles Babbage',
            email: 'charles@difference-engine.org',
         })

         const task = await TaskItem.factory({
            title: 'Review cogwheel mechanics',
         })

         task.set('contact', contact)
         expect(task.val('contact')).toBe(contact)
      })

      it('should serialize TaskItem with contact reference to JSON', async () => {
         const contactUri = new ObjectUri('contacts/c-100', 'Katherine Johnson')
         const task = await TaskItem.factory({
            title: 'Calculate orbital trajectory',
            isCompleted: false,
         })

         task.set('contact', contactUri)
         const json = task.dataObject.toJSON({ objectsAsReferences: true })

         expect(json.title).toBe('Calculate orbital trajectory')
         expect(json.isCompleted).toBe(false)
         expect(json.contact).toBeDefined()
      })
   })
})
