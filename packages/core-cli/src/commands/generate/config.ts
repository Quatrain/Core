import inquirer from 'inquirer'
import fs from 'fs'
import path from 'path'

export async function generateConfig() {
   console.log('--- Initializing Quatrain Configuration ---\n')

   const answers = await inquirer.prompt([
      {
         type: 'list',
         name: 'backend',
         message: 'Which Backend system to use?',
         choices: [
            { name: 'SQLite', value: 'sqlite' },
            { name: 'PostgreSQL', value: 'postgres' },
            { name: 'Firestore', value: 'firestore' },
            { name: 'None (Mock)', value: 'mock' },
         ],
      },
      {
         type: 'list',
         name: 'auth',
         message: 'Which Authentication provider to use?',
         choices: [
            { name: 'Supabase', value: 'supabase' },
            { name: 'Firebase', value: 'firebase' },
            { name: 'None', value: 'none' },
         ],
      },
      {
         type: 'list',
         name: 'queue',
         message: 'Which Queue system to use?',
         choices: [
            { name: 'AMQP (RabbitMQ)', value: 'amqp' },
            { name: 'AWS SQS', value: 'sqs' },
            { name: 'GCP Pub/Sub', value: 'gcp' },
            { name: 'None', value: 'none' },
         ],
      },
      {
         type: 'list',
         name: 'storage',
         message: 'Which Storage provider to use?',
         choices: [
            { name: 'AWS S3', value: 's3' },
            { name: 'Supabase Storage', value: 'supabase' },
            { name: 'Firebase Storage', value: 'firebase' },
            { name: 'None', value: 'none' },
         ],
      }
   ])

   const config: any = {}

   // --- Backend Config ---
   if (answers.backend !== 'mock') {
      config.backend = {
         adapter: answers.backend === 'sqlite' ? 'SQLiteAdapter' : 
                  answers.backend === 'postgres' ? 'PostgresAdapter' : 'FirestoreAdapter',
         package: `@quatrain/backend-${answers.backend}`,
         config: {}
      }
      if (answers.backend === 'sqlite') {
         config.backend.config.database = 'env(DB_PATH)'
      } else if (answers.backend === 'postgres') {
         config.backend.config.host = 'env(PG_HOST)'
         config.backend.config.port = 'env(PG_PORT)'
         config.backend.config.user = 'env(PG_USER)'
         config.backend.config.password = 'env(PG_PWD)'
         config.backend.config.database = 'env(PG_DB)'
      }
   }

   // --- Auth Config ---
   if (answers.auth !== 'none') {
      config.auth = {
         adapter: answers.auth === 'supabase' ? 'SupabaseAuthAdapter' : 'FirebaseAuthAdapter',
         package: `@quatrain/auth-${answers.auth}`,
         config: {}
      }
      if (answers.auth === 'supabase') {
         config.auth.config.supabaseUrl = 'env(SUPABASE_URL)'
         config.auth.config.supabaseKey = 'env(SUPABASE_KEY)'
      }
   }

   // --- Queue Config ---
   if (answers.queue !== 'none') {
      const adapterMap: Record<string, string> = { amqp: 'AmqpQueueAdapter', sqs: 'SqsAdapter', gcp: 'GcpPubSubAdapter' }
      const pkgMap: Record<string, string> = { amqp: 'amqp', sqs: 'aws', gcp: 'gcp' }
      config.queue = {
         adapter: adapterMap[answers.queue as string],
         package: `@quatrain/queue-${pkgMap[answers.queue as string]}`,
         config: {}
      }
      if (answers.queue === 'amqp') {
         config.queue.config.host = 'env(MQ_HOST)'
         config.queue.config.port = 'env(MQ_PORT)'
         config.queue.config.user = 'env(MQ_USER)'
         config.queue.config.password = 'env(MQ_PWD)'
      }
   }

   // --- Storage Config ---
   if (answers.storage !== 'none') {
      const adapterMap: Record<string, string> = { s3: 'S3StorageAdapter', supabase: 'SupabaseStorageAdapter', firebase: 'FirebaseStorageAdapter' }
      config.storage = {
         adapter: adapterMap[answers.storage as string],
         package: `@quatrain/storage-${answers.storage}`,
         config: {}
      }
      if (answers.storage === 's3') {
         config.storage.config.accesskey = 'env(S3_ACCESS_KEY)'
         config.storage.config.secret = 'env(S3_SECRET_KEY)'
         config.storage.config.region = 'env(S3_REGION)'
         config.storage.config.bucket = 'env(S3_BUCKET)'
      }
   }

   const outputPath = path.resolve(process.cwd(), 'quatrain.json')
   fs.writeFileSync(outputPath, JSON.stringify(config, null, 3), 'utf8')

   console.log(`\n✅ Configuration file successfully generated at: ${outputPath}`)
   console.log('Tokens formatted as "env(...)" will automatically be replaced by the Bootloader with runtime environment variables.\n')
}
