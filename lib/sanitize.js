/**
 * OData filter parameter sanitization.
 *
 * Risk: string params interpolated into OData $filter strings can alter filter
 * logic if they contain single quotes. OData standard escaping doubles them.
 *
 * Example attack: warehouse = "102' or '1' eq '1"
 *   Unescaped → WarehouseNumber eq '102' or '1' eq '1'  (returns all rows)
 *   Escaped   → WarehouseNumber eq '102'' or ''1'' eq ''1'  (literal match, safe)
 */

/**
 * Escape a string value for safe use inside an OData filter string literal.
 * Doubles single quotes per OData URI convention (RFC 3986 + OData v4 spec §5.1.1.6.1).
 * Returns the value unchanged if it is null or undefined.
 *
 * @param {string|null|undefined} val
 * @returns {string|null|undefined}
 */
export function esc(val) {
  if (val == null) return val;
  return String(val).replace(/'/g, "''");
}
