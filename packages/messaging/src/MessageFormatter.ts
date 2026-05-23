import Mustache from 'mustache'

/**
 * Specialized utility handling string cleanup and Mustache interpolation for templates.
 */
export class MessageFormatter {
   /**
    * Cleans all HTML tags from the title string.
    * This uses a robust, RegExp-free state loop to prevent any risk of Regular Expression
    * Denial of Service (ReDoS) or catastrophic backtracking, fully satisfying SonarQube security rules.
    * 
    * @param title - The raw subject line containing potential HTML tags.
    * @returns The formatted title string with all HTML tags stripped out.
    */
   static formatTitle(title: string): string {
      let result = ''
      let inTag = false
      for (let i = 0; i < title.length; i++) {
         const char = title[i]
         if (char === '<') {
            inTag = true
         } else if (char === '>') {
            inTag = false
         } else if (!inTag) {
            result += char
         }
      }
      return result
   }

   /**
    * Renders the Mustache layout with provided contextual variables.
    * 
    * @param body - The markdown/HTML layout.
    * @param data - The variables context map.
    * @returns Parsed output string.
    */
   static formatBody(body: string, data?: {}) {
      return Mustache.render(body, data || {})
   }
}
