import { AUDIT_ACTIONS } from "../core/constants.js";
import { auditRepository } from "../data/repositories.js";
import { createId } from "../utils/helpers.js";
import { getActorId, getSession } from "./authService.js";

export const recordAudit = async ({
  action,
  entity,
  entityId,
  previousValue = null,
  newValue = null,
  actorId,
} = {}) => {
  const session = getSession();
  const record = {
    id: createId(),
    actor: actorId || session?.email || getActorId(),
    actorId: actorId || session?.userId || getActorId(),
    action,
    entity,
    entityId,
    previousValue,
    newValue,
    timestamp: new Date().toISOString(),
  };
  await auditRepository.save(record);
  return record;
};

export const listAuditLogs = async ({ action, entity, query } = {}) => {
  const rows = await auditRepository.getAll();
  const needle = String(query ?? "").trim().toLocaleLowerCase("en-US");
  return rows
    .filter((row) => {
      if (action && row.action !== action) return false;
      if (entity && row.entity !== entity) return false;
      if (!needle) return true;
      const haystack = [row.action, row.entity, row.entityId, row.actor]
        .join(" ")
        .toLocaleLowerCase("en-US");
      return haystack.includes(needle);
    })
    .sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp)));
};

export { AUDIT_ACTIONS };

export default Object.freeze({ recordAudit, listAuditLogs });
