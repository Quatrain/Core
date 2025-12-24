import {
   StringProperty,
   NumberProperty,
   DateTimeProperty,
   ObjectProperty,
   BaseObjectType,
   EnumProperty,
} from '@quatrain/core'
import {
   Backend,
   Filter,
   OperatorKeys,
   PersistedBaseObject,
} from '@quatrain/backend'
import { SQLiteAdapter } from '@quatrain/backend-sqlite'
import { Auth } from '@quatrain/auth'
import { SupabaseAuthAdapter } from '@quatrain/auth-supabase'

// -----------------------------------------------------------------------------
// 1. MODEL DEFINITIONS (Business Layer)
// -----------------------------------------------------------------------------

export interface ClientType extends BaseObjectType {
   name: string
   email: string
   status: 'active' | 'inactive'
}

export interface OrderType extends BaseObjectType {
   name: string
   amount?: number
   date?: Date
   client: Client
   status: 'created' | 'paid' | 'shipped' | 'cancelled'
}

/**
 * Client Model
 * Defines properties and business rules for a client.
 */
export class Client extends PersistedBaseObject {
   static COLLECTION = 'clients'
   static PROPS_DEFINITION = [
      {
         name: 'name',
         type: StringProperty.TYPE,
         mandatory: true,
         maxLength: 100,
      },
      {
         name: 'email',
         type: StringProperty.TYPE,
         mandatory: true,
      },
      {
         name: 'status',
         type: EnumProperty.TYPE,
         values: ['active', 'inactive'],
         defaultValue: 'active',
      },
   ]
}

/**
 * Order Model
 * Linked to a client via an ObjectProperty.
 */
export class Order extends PersistedBaseObject {
   static COLLECTION = 'orders'
   static PROPS_DEFINITION = [
      {
         name: 'name',
         type: StringProperty.TYPE,
         mandatory: true,
      },
      {
         name: 'amount',
         type: NumberProperty.TYPE,
         mandatory: true,
         min: 0,
      },
      {
         name: 'date',
         type: DateTimeProperty.TYPE,
         defaultValue: () => new Date(),
      },
      {
         name: 'client',
         type: ObjectProperty.TYPE,
         instanceOf: 'Client',
         mandatory: true,
      },
      {
         name: 'status',
         type: EnumProperty.TYPE,
         values: ['created', 'paid', 'shipped', 'cancelled'],
         defaultValue: 'created',
      },
   ]
}

// -----------------------------------------------------------------------------
// 2. CONFIGURATION AND EXECUTION (Infrastructure Layer)
// -----------------------------------------------------------------------------

async function runDemo() {
   Backend.info('🏗️  Initializing local backend...')

   // A. Database Configuration (SQLite)
   // We use SQLite for local testing to avoid requiring a running database server.
   const dbAdapter = new SQLiteAdapter({
      config: {
         filename: './demo.db',
      },
   })

   // Register the adapter as 'default' to be used by models
   Backend.addBackend(dbAdapter, 'default')

   // B. Authentication Configuration (Supabase Auth)
   // Handles user registration and login
   const authAdapter = new SupabaseAuthAdapter({
      config: {
         url: process.env.SUPABASE_URL || 'https://ref.supabase.co',
         anonKey: process.env.SUPABASE_ANON_KEY || 'public-anon-key',
      },
   })
   Auth.addProvider(authAdapter, 'default')

   try {
      Backend.info('🚀 Starting scenario...')

      // 1. Setting values via an object (using fromObject)
      const client = await Client.fromObject<ClientType>({
         name: 'Entreprise ACME',
         email: 'contact@acme.com',
         status: 'active',
      })
      await client.save()
      Backend.info(`✅ Client created: ${client._.name} (ID: ${client._.id})`)

      // 2. Create an order linked to the client
      // Demonstrating other ways to set values:
      const order = await Order.fromObject<OrderType>({
         name: `CMD-${Date.now()}`, // Way 1: Object in factory
         client,
         status: 'created',
      })
      order.set('amount', 1250.0) // Way 2: Using the .set() method
      order._.client = client // Way 3: Using the ._ proxy accessor

      await order.save()
      Backend.info(`✅ Order created: ${order._.name}`)

      // 3. Find orders for this client
      const orders = await Backend.find(Order.factory(), [
         new Filter('client.id', client._.id, OperatorKeys.equals),
      ])
      Backend.info(`📦 Orders found for this client: ${orders.length}`)
   } catch (error) {
      Backend.error('❌ Error:', error)
   }
}

// Execution
if (require.main === module) {
   runDemo()
}
