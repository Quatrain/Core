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
   networks?: string[]
}

export interface ComposeFile {
   version?: string
   services: Record<string, ComposeService>
   volumes?: Record<string, any>
   networks?: Record<string, any>
}

export class InfraBuilder {
   /**
    * Génère le contenu des fichiers compose.yaml, .env et Containerfile en fonction de la configuration de l'application
    */
   public static build(config: any, appName?: string): { compose: string, env: string, dockerfile: string } {
      const finalAppName = appName || config.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'quatrain-app'
      const compose: ComposeFile = {
         services: {},
         volumes: {},
         networks: {
            [`${finalAppName}-net`]: { driver: 'bridge' }
         }
      }

      const envVars: Record<string, string> = {}

      // 1. Backend Engine Container
      compose.services['engine'] = {
         build: {
            context: '.',
            dockerfile: 'Containerfile'
         },
         restart: 'unless-stopped',
         ports: ['4001:4001'],
         environment: {
            NODE_ENV: 'production'
         },
         networks: [`${finalAppName}-net`],
         volumes: ['./quatrain.json:/app/quatrain.json:ro', './data:/app/data'],
         depends_on: []
      }

      // 1b. Frontend UI Container
      compose.services['ui'] = {
         build: {
            context: './web',
            dockerfile: 'Dockerfile'
         },
         restart: 'unless-stopped',
         ports: ['3000:80'],
         networks: [`${finalAppName}-net`],
         depends_on: ['engine']
      }

      // 2. Backend Infrastructure
      if (config.backend && config.backend.adapter === 'PostgresAdapter') {
         const dbUser = 'quatrain'
         const dbPass = 'quatrain_pass'
         const dbName = 'quatrain_db'

         compose.services['postgres'] = {
            image: 'postgres:15-alpine',
            restart: 'unless-stopped',
            ports: ['5432:5432'],
            environment: {
               POSTGRES_USER: dbUser,
               POSTGRES_PASSWORD: dbPass,
               POSTGRES_DB: dbName
            },
            networks: [`${finalAppName}-net`],
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
            restart: 'unless-stopped',
            ports: ['9000:9000', '9001:9001'],
            environment: {
               MINIO_ROOT_USER: s3User,
               MINIO_ROOT_PASSWORD: s3Pass
            },
            networks: [`${finalAppName}-net`],
            command: 'server /data --console-address ":9001"',
            volumes: ['minio_data:/data']
         }
         compose.volumes!['minio_data'] = {}

         // Link to Engine
         compose.services['engine'].depends_on!.push('minio')
         envVars['S3_ENDPOINT'] = `http://minio:9000`
         envVars['S3_ACCESS_KEY'] = s3User
         envVars['S3_SECRET_KEY'] = s3Pass
      } else if (config.storage && config.storage.adapter === 'LocalAdapter') {
         const storagePath = config.storage.config?.path || '/data/storage'
         compose.services['engine'].volumes!.push(`local_storage_data:${storagePath}`)
         compose.volumes!['local_storage_data'] = {}
      }

      // 4. Messaging/Queue Infrastructure
      if (config.queue && config.queue.adapter === 'AmqpAdapter') {
         compose.services['rabbitmq'] = {
            image: 'rabbitmq:3-management-alpine',
            restart: 'unless-stopped',
            networks: [`${finalAppName}-net`],
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
      
      const dockerfile = `
FROM oven/bun:latest
WORKDIR /app
COPY package.json tsconfig.json quatrain.json ./
RUN bun install
COPY src ./src
COPY data ./data
EXPOSE 4001
CMD ["bun", "run", "src/index.ts"]
      `.trim()

      return { compose: composeYaml, env: envFile, dockerfile }
   }
}
