import { PersistedBaseObject } from '@quatrain/backend'
import { BaseObjectProperties, Core, StringProperty } from '@quatrain/core'

/**
 * Persisted form of a membership: one user in one tenant, with roles.
 *
 * `pair` is a digest of the tenant and member identifiers, declared unique: it is what stops a
 * user from being recorded twice in the same tenant. `member` holds the user identifier issued by
 * the authentication layer, which need not be a Quatrain `User` record. `roles` holds a JSON array.
 */
export class Membership extends PersistedBaseObject {
   static COLLECTION = 'tenant_memberships'

   static PROPS_DEFINITION = [
      ...BaseObjectProperties,
      { name: 'pair', type: StringProperty.TYPE, mandatory: true, unique: true },
      { name: 'tenant', type: StringProperty.TYPE, mandatory: true },
      { name: 'member', type: StringProperty.TYPE, mandatory: true },
      { name: 'roles', type: StringProperty.TYPE },
   ]

   /**
    * Membership creation factory.
    *
    * @param src - Identifier or content.
    * @returns The Membership instance.
    */
   static async factory(src: any = undefined): Promise<Membership> {
      return super.factory(src, Membership)
   }
}

Core.addClass('Membership', Membership)
