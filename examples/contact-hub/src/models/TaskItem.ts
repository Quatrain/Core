import { PersistedBaseObject } from '@quatrain/backend'
import {
   Core,
   StringProperty,
   BooleanProperty,
   DateTimeProperty,
   ObjectProperty,
   BaseObjectProperties,
   BaseObjectType,
   htmlType,
   ObjectUri,
} from '@quatrain/core'

/**
 * TypeScript interface defining the shape of a TaskItem data object.
 */
export interface TaskItemType extends BaseObjectType {
   title: string
   dueDate?: Date | string | number
   isCompleted?: boolean
   contact?: ObjectUri | any
}

/**
 * Declarative property schema definition for the TaskItem entity.
 */
export const TaskItemProperties = [
   ...BaseObjectProperties,
   {
      name: 'name',
      mandatory: false,
      type: StringProperty.TYPE,
   },
   {
      name: 'title',
      mandatory: true,
      type: StringProperty.TYPE,
      minLength: 1,
      maxLength: 200,
      fullSearch: true,
      htmlType: htmlType.TEXT,
      onChange: (dao: any) => {
         if (!dao.val('name')) {
            dao.set('name', dao.val('title'))
         }
      },
   },
   {
      name: 'dueDate',
      mandatory: false,
      type: DateTimeProperty.TYPE,
      htmlType: htmlType.TEXT,
   },
   {
      name: 'isCompleted',
      mandatory: false,
      type: BooleanProperty.TYPE,
      defaultValue: false,
      htmlType: htmlType.CHECKBOX,
   },
   {
      name: 'contact',
      mandatory: false,
      type: ObjectProperty.TYPE,
      instanceOf: 'Contact',
   },
]

/**
 * Domain model representing an actionable to-do item linked to a Contact.
 * Extends `PersistedBaseObject` to provide declarative schema validation and database portability.
 */
export class TaskItem extends PersistedBaseObject {
   /** Schema definition for TaskItem properties. */
   static PROPS_DEFINITION = TaskItemProperties

   /** The database collection or table name. */
   static COLLECTION = 'tasks'

   /** The label key used for human-readable display. */
   static LABEL_KEY = 'title'

   /**
    * Instantiates a TaskItem model from raw data, ObjectUri, or path.
    *
    * @param src - Raw data dictionary, ObjectUri, or backend path.
    * @returns A promise resolving to the TaskItem instance.
    */
   static async factory(src?: any): Promise<TaskItem> {
      return super.factory(src, TaskItem)
   }
}

Core.addClass('TaskItem', TaskItem)
