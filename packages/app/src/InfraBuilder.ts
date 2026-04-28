import * as yaml from 'yaml'

export interface ComposeService {
   image?: string
   build?: string | { context: string, dockerfile?: string }
   container_name?: string
   restart?: string
   ports?: string[]
   environment?: Record<string, string>
   volumes?: string[]
   command?: string
   depends_on?: string[]
}

export interface ComposeFile {
   version?: string
   services: Record<string, ComposeService>
   volumes?: Record<string, any>
}

export class InfraBuilder {
   /**
    * Génère le contenu des fichiers compose.yaml et .env en fonction de la configuration de l'application
    */
   public static build(config: any, appName: string = 'quatrain-app'): { compose: string, env: string } {
      const compose: ComposeFile = {
         services: {},
         volumes: {}
      }

      const envVars: Record<string, string> = {}

      // 1. Unified Engine Container (API + Front)
      compose.services['engine'] = {
         image: 'quatrain-engine:latest', // For the PoC, a local generic image
         container_name: `${appName}-engine`,
         restart: 'unless-stopped',
         ports: ['3000:3000', '4000:4000'],
         environment: {
            NODE_ENV: 'production'
         },
         volumes: ['./quatrain.json:/app/quatrain.json:ro'],
         depends_on: []
      }

      // 2. Backend Infrastructure
      if (config.backend && config.backend.adapter === 'PostgresAdapter') {
         const dbUser = 'quatrain'
         const dbPass = 'quatrain_pass'
         const dbName = 'quatrain_db'

         compose.services['postgres'] = {
            image: 'postgres:15-alpine',
            container_name: `${appName}-postgres`,
            restart: 'unless-stopped',
            ports: ['5432:5432'],
            environment: {
               POSTGRES_USER: dbUser,
               POSTGRES_PASSWORD: dbPass,
               POSTGRES_DB: dbName
            },
            volumes: ['postgres_data:/var/lib/postgresql/data']
         }
         compose.volumes!['postgres_data'] = {}

         // Link to Engine
         compose.services['engine'].depends_on!.push('postgres')
         envVars['DATABASE_URL'] = `postgresql://${dbUser}:${dbPass}@postgres:5432/${dbName}`
      }

      // 3. Storage Infrastructure
      if (config.storage && config.storage.adapter === 'S3Adapter') {
         const s3User = 'minioadmin'
         const s3Pass = 'minioadminpassword'

         compose.services['minio'] = {
            image: 'minio/minio:latest',
            container_name: `${appName}-minio`,
            restart: 'unless-stopped',
            ports: ['9000:9000', '9001:9001'],
            environment: {
               MINIO_ROOT_USER: s3User,
               MINIO_ROOT_PASSWORD: s3Pass
            },
            command: 'server /data --console-address ":9001"',
            volumes: ['minio_data:/data']
         }
         compose.volumes!['minio_data'] = {}

         // Link to Engine
         compose.services['engine'].depends_on!.push('minio')
         envVars['S3_ENDPOINT'] = `http://minio:9000`
         envVars['S3_ACCESS_KEY'] = s3User
         envVars['S3_SECRET_KEY'] = s3Pass
      }

      // 4. Messaging/Queue Infrastructure
      if (config.queue && config.queue.adapter === 'AmqpAdapter') {
         compose.services['rabbitmq'] = {
            image: 'rabbitmq:3-management-alpine',
            container_name: `${appName}-rabbitmq`,
            restart: 'unless-stopped',
            ports: ['5672:5672', '15672:15672']
         }
         
         // Link to Engine
         compose.services['engine'].depends_on!.push('rabbitmq')
         envVars['AMQP_URL'] = `amqp://rabbitmq:5672`
      }

      // Clean empty dependencies
      if (compose.services['engine'].depends_on?.length === 0) {
         delete compose.services['engine'].depends_on
      }

      // Clean empty volumes
      if (Object.keys(compose.volumes!).length === 0) {
         delete compose.volumes
      }

      // Generate outputs
      const composeYaml = yaml.stringify(compose)
      const envFile = Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join('\n')

      return { compose: composeYaml, env: envFile }
   }
}
