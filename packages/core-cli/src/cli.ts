import { Command } from 'commander'
import { generateConfig } from './commands/generate/config'
import { generateMigration } from './commands/generate/migration'
import { generateScaffold } from './commands/generate/scaffold'

const program = new Command()

program
   .name('core')
   .description('Global CLI for Quatrain Core (configuration generation, migrations...)')
   .version('1.0.0')

const generate = program
   .command('generate')
   .description('Generate files (config, migration, etc.)')

generate
   .command('config')
   .description('Generate a normalized configuration file for the bootloader')
   .action(generateConfig)

generate
   .command('migration <name>')
   .description('Generate a blank migration file')
   .action(generateMigration)

generate
   .command('scaffold <project-name>')
   .description('Initialize a new Quatrain project with its basic structure')
   .action(generateScaffold)

program.parse(process.argv)
