import { Command } from 'commander'
import inquirer from 'inquirer'
import { StudioProject, StudioAgent, CodeGenerator } from '@quatrain/studio'
import { SQLiteAdapter } from '@quatrain/backend-sqlite'
import { Backend } from '@quatrain/backend'
import { Ai } from '@quatrain/ai'
import { GeminiAdapter } from '@quatrain/ai-gemini'

// Initialize the backend and AI for the CLI
Backend.addBackend(new SQLiteAdapter({ config: ':memory:' }), 'default', true) // In a real scenario, use a file like './studio.sqlite'
Ai.setAdapter(new GeminiAdapter(process.env.GEMINI_API_KEY || 'no-key'))

const program = new Command()

program
   .name('quatrain-studio')
   .description('CLI to generate Quatrain apps using AI')
   .version('1.0.0')

program
   .command('init')
   .description('Initialize a new Studio Project')
   .argument('<name>', 'Project name')
   .action(async (name) => {
      console.log(`Initializing project '${name}'...`)
      const project = await StudioProject.factory()
      project.set('name', name)
      await project.save()
      console.log(`Project '${name}' initialized with ID: ${project.uid}`)
   })

program
   .command('prompt')
   .description('Generate models from a natural language prompt')
   .argument('<projectId>', 'ID of the project')
   .argument('<prompt>', 'Natural language prompt')
   .action(async (projectId, promptText) => {
      console.log(`Sending prompt to AI for project ${projectId}...`)
      try {
         const model = await StudioAgent.generateModelFromPrompt(promptText, projectId)
         console.log(`✅ Model '${model.val('name')}' generated successfully!`)
      } catch (e) {
         console.error('Error generating model:', (e as Error).message)
      }
   })

program
   .command('generate')
   .description('Generate TypeScript code for a specific model')
   .argument('<modelId>', 'ID of the model')
   .action(async (modelId) => {
      // In a real implementation, we would fetch the model and its properties from SQLite
      // For now, this is just a skeleton.
      console.log(`Generating code for model ${modelId}...`)
      console.log(`Code generated! (Not actually written to disk yet)`)
   })

program.parse(process.argv)
