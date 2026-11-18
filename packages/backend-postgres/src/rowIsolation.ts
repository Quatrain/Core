import { BackendError } from '@quatrain/backend'

const SQL_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/
const SESSION_SETTING = /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/

function assertIdentifier(value: unknown, label: string): asserts value is string {
   if (typeof value !== 'string' || !SQL_IDENTIFIER.test(value)) {
      throw new BackendError(`${label} must be a lowercase SQL identifier (a-z, 0-9, _)`)
   }
}

/**
 * Options of {@link rowIsolationSql}.
 */
export interface RowIsolationOptions {
   /** Column holding the owner of each row (default `tenant`). */
   column?: string
   /** Session setting holding the current owner (default `app.tenant`). */
   setting?: string
   /** Schema of the table, when it is not on the search path. */
   schema?: string
   /** Name of the policy (default `row_isolation`). */
   policy?: string
}

/**
 * Builds the DDL restricting a table to the rows owned by the current session, with PostgreSQL
 * row-level security.
 *
 * Once applied, a statement sees and writes only the rows whose owner column equals the session
 * setting; a statement run without the setting sees no row and cannot write. `FORCE` makes the
 * policy apply to the table owner too. The adapter sets the setting when it is given a
 * `config.sessionSettings` function. Run the result in a migration, with a role allowed to alter
 * the table.
 *
 * @param table - Table to protect; it must already have the owner column.
 * @param options - Column, setting, schema and policy names.
 * @returns Idempotent SQL statements.
 * @throws {BackendError} If a name is not a plain lowercase identifier.
 */
export function rowIsolationSql(table: string, options: RowIsolationOptions = {}): string {
   const column = options.column ?? 'tenant'
   const setting = options.setting ?? 'app.tenant'
   const policy = options.policy ?? 'row_isolation'
   assertIdentifier(table, 'The table name')
   assertIdentifier(column, 'The owner column name')
   assertIdentifier(policy, 'The policy name')
   if (options.schema !== undefined) {
      assertIdentifier(options.schema, 'The schema name')
   }
   if (!SESSION_SETTING.test(setting)) {
      throw new BackendError('The session setting must be of the form namespace.name')
   }
   const target = options.schema === undefined ? table : `${options.schema}.${table}`
   const owner = `nullif(current_setting('${setting}', true), '')`
   return [
      `ALTER TABLE ${target} ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE ${target} FORCE ROW LEVEL SECURITY;`,
      `DROP POLICY IF EXISTS ${policy} ON ${target};`,
      `CREATE POLICY ${policy} ON ${target} USING (${column} = ${owner}) WITH CHECK (${column} = ${owner});`,
   ].join('\n')
}

/**
 * Checks that the role used by an adapter is subject to row-level security.
 * Superusers and roles with `BYPASSRLS` ignore every policy: an application connected with one
 * has no isolation at all. Call this at start-up.
 *
 * @param adapter - Adapter (or anything exposing `rawQuery`) connected as the application role.
 * @throws {BackendError} If the role bypasses row-level security.
 */
export async function assertRowSecurityRole(adapter: { rawQuery(sql: string, params?: any[]): Promise<any> }): Promise<void> {
   const result = await adapter.rawQuery('SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user')
   const role = result?.rows?.[0]
   if (!role || role.rolsuper || role.rolbypassrls) {
      throw new BackendError(`The database role '${role?.rolname ?? 'unknown'}' bypasses row-level security: rows would not be isolated`)
   }
}
