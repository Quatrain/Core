/**
 * Static utility helpers for processing standard HTTP request parameters and headers.
 */
export class HttpHelper {
   /**
    * Extracts a bearer token from an Authorization header.
    * 
    * @param authorization - The raw Authorization header string (e.g. 'Bearer <token>').
    * @returns The extracted token string, or an empty string if invalid or missing.
    */
   static parseBearerToken(authorization: string | undefined): string {
      if (!authorization) return ''
      return authorization.split(' ')[1] || ''
   }

   /**
    * Extracts username and password credentials from a Basic Authorization header.
    * 
    * @param authorization - The raw Authorization header string (e.g. 'Basic <credentials>').
    * @returns An object containing the user and pass properties, or null if parsing fails.
    */
   static parseBasicAuth(authorization: string | undefined): { user: string; pass: string } | null {
      if (!authorization) return null
      const b64auth = authorization.split(' ')[1] || ''
      if (!b64auth) return null
      try {
         let decoded: string
         if (typeof atob === 'function') {
            decoded = atob(b64auth)
         } else {
            decoded = Buffer.from(b64auth, 'base64').toString()
         }
         const [user, pass] = decoded.split(':')
         if (user === undefined || pass === undefined) return null
         return { user, pass }
      } catch {
         return null
      }
   }
}

