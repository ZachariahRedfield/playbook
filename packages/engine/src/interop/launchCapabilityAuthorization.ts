import { createHash } from 'node:crypto';
import type { PlaybookLifelineInteropRuntimeArtifact } from '@zachariahredfield/playbook-core';
import { getFitnessActionContract, isFitnessActionName } from '../integrations/fitnessContract.js';
import type { WorkerLaunchPlanArtifact } from '../orchestration/workerLaunchPlan.js';

const deterministicStringify = (value: unknown): string => JSON.stringify(value, null, 2);
const stableSorted = <T>(values: readonly T[], comparator: (left: T, right: T) => number): T[] => [...values].sort(comparator);
const stableUniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));

const INTEROP_CAPABILITY_PREFIXES = ['runtime-capability:', 'interop-capability:'] as const;
const INTEROP_ACTION_FAMILY_PREFIXES = ['runtime-action-family:', 'interop-action-family:'] as const;

type CapabilityRequirement = {
  requiredCapabilityIds: string[];
  requiredActionFamilies: string[];
};

export type RuntimeCapabilityAuthorizationBlocker = {
  lane_id: string;
  blocker_code:
    | 'missing-required-runtime-capability'
    | 'required-action-family-not-declared'
    | 'runtime-capability-registration-stale-or-conflicted';
  reason: string;
  blocked_capability_ids: string[];
};

export type RuntimeCapabilityAuthorizationResult = {
  ok: boolean;
  runtime_capability_fingerprint: string;
  blocked_lane_ids: string[];
  blockers: RuntimeCapabilityAuthorizationBlocker[];
};

const parseCapabilityRequirement = (requiredCapabilities: readonly string[]): CapabilityRequirement => {
  const requiredCapabilityIds = stableUniqueSorted(
    requiredCapabilities.flatMap((entry) => {
      const prefix = INTEROP_CAPABILITY_PREFIXES.find((candidate) => entry.startsWith(candidate));
      return prefix ? [entry.slice(prefix.length).trim()] : [];
    })
  );

  const requiredActionFamilies = stableUniqueSorted(
    requiredCapabilities.flatMap((entry) => {
      const prefix = INTEROP_ACTION_FAMILY_PREFIXES.find((candidate) => entry.startsWith(candidate));
      return prefix ? [entry.slice(prefix.length).trim()] : [];
    })
  );

  return {
    requiredCapabilityIds,
    requiredActionFamilies
  };
};

const capabilityFingerprint = (capability: PlaybookLifelineInteropRuntimeArtifact['capabilities'][number]): string =>
  createHash('sha256').update(deterministicStringify(capability), 'utf8').digest('hex');

const runtimeFingerprint = (runtime: Pick<PlaybookLifelineInteropRuntimeArtifact, 'capabilities'>): string => {
  const normalized = stableSorted(
    runtime.capabilities.map((entry) => ({
      ...entry,
      routing: {
        channel: entry.routing.channel,
        target: entry.routing.target,
        priority: entry.routing.priority,
        maxDeliveryLatencySeconds: entry.routing.maxDeliveryLatencySeconds
      }
    })),
    (left, right) => {
      const idComparison = left.capability_id.localeCompare(right.capability_id);
      if (idComparison !== 0) return idComparison;
      return capabilityFingerprint(left).localeCompare(capabilityFingerprint(right));
    }
  );
  return createHash('sha256').update(deterministicStringify(normalized), 'utf8').digest('hex');
};

const evaluateCapabilityRegistrationConflicts = (
  runtime: PlaybookLifelineInteropRuntimeArtifact
): {
  conflictedCapabilityIds: string[];
  staleCapabilityIds: string[];
  familyByCapabilityId: Map<string, string>;
  capabilityById: Map<string, PlaybookLifelineInteropRuntimeArtifact['capabilities'][number]>;
} => {
  const byId = new Map<string, PlaybookLifelineInteropRuntimeArtifact['capabilities']>();
  for (const capability of runtime.capabilities) {
    const existing = byId.get(capability.capability_id) ?? [];
    existing.push(capability);
    byId.set(capability.capability_id, existing);
  }

  const conflictedCapabilityIds = stableUniqueSorted(
    [...byId.entries()].flatMap(([capabilityId, registrations]) => {
      if (registrations.length <= 1) return [];
      const fingerprints = stableUniqueSorted(registrations.map((entry) => capabilityFingerprint(entry)));
      return fingerprints.length > 1 ? [capabilityId] : [];
    })
  );

  const staleCapabilityIds = stableUniqueSorted(
    runtime.capabilities.flatMap((capability) => {
      if (!isFitnessActionName(capability.action_kind)) return [capability.capability_id];
      const contract = getFitnessActionContract(capability.action_kind);
      const routingMismatch =
        capability.routing.channel !== contract.routing.channel ||
        capability.routing.target !== contract.routing.target ||
        capability.routing.priority !== contract.routing.priority ||
        capability.routing.maxDeliveryLatencySeconds !== contract.routing.maxDeliveryLatencySeconds;
      return routingMismatch ? [capability.capability_id] : [];
    })
  );

  const familyByCapabilityId = new Map<string, string>();
  const capabilityById = new Map<string, PlaybookLifelineInteropRuntimeArtifact['capabilities'][number]>();
  for (const capability of runtime.capabilities) {
    familyByCapabilityId.set(capability.capability_id, capability.routing.target);
    if (!capabilityById.has(capability.capability_id)) capabilityById.set(capability.capability_id, capability);
  }

  return { conflictedCapabilityIds, staleCapabilityIds, familyByCapabilityId, capabilityById };
};

export const evaluateRuntimeCapabilityAuthorization = (
  launchPlan: WorkerLaunchPlanArtifact,
  runtime: PlaybookLifelineInteropRuntimeArtifact
): RuntimeCapabilityAuthorizationResult => {
  const blocked: RuntimeCapabilityAuthorizationBlocker[] = [];
  const runtime_capability_fingerprint = runtimeFingerprint(runtime);
  const registrationIntegrity = evaluateCapabilityRegistrationConflicts(runtime);

  for (const lane of launchPlan.lanes.filter((entry) => entry.launchEligible)) {
    const requirements = parseCapabilityRequirement(lane.requiredCapabilities ?? []);
    if (requirements.requiredCapabilityIds.length === 0 && requirements.requiredActionFamilies.length === 0) continue;

    const missingCapabilityIds = stableUniqueSorted(requirements.requiredCapabilityIds.filter((capabilityId) => !registrationIntegrity.capabilityById.has(capabilityId)));
    if (missingCapabilityIds.length > 0) {
      blocked.push({
        lane_id: lane.lane_id,
        blocker_code: 'missing-required-runtime-capability',
        reason: `Required runtime capability registration is missing: ${missingCapabilityIds.join(', ')}`,
        blocked_capability_ids: missingCapabilityIds
      });
    }

    const conflictedOrStaleRequiredIds = stableUniqueSorted(
      requirements.requiredCapabilityIds.filter(
        (capabilityId) =>
          registrationIntegrity.conflictedCapabilityIds.includes(capabilityId) || registrationIntegrity.staleCapabilityIds.includes(capabilityId)
      )
    );
    if (conflictedOrStaleRequiredIds.length > 0) {
      blocked.push({
        lane_id: lane.lane_id,
        blocker_code: 'runtime-capability-registration-stale-or-conflicted',
        reason: `Capability registration is stale or conflicted: ${conflictedOrStaleRequiredIds.join(', ')}`,
        blocked_capability_ids: conflictedOrStaleRequiredIds
      });
    }

    const declaredFamilies = stableUniqueSorted(
      requirements.requiredCapabilityIds
        .map((capabilityId) => registrationIntegrity.familyByCapabilityId.get(capabilityId))
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    );

    const missingFamilyRequirements = stableUniqueSorted(
      requirements.requiredActionFamilies.filter((family) => !declaredFamilies.includes(family))
    );
    if (missingFamilyRequirements.length > 0) {
      const affectedIds = stableUniqueSorted(requirements.requiredCapabilityIds);
      blocked.push({
        lane_id: lane.lane_id,
        blocker_code: 'required-action-family-not-declared',
        reason: `Required runtime action family is not declared by capability registration: ${missingFamilyRequirements.join(', ')}`,
        blocked_capability_ids: affectedIds
      });
    }
  }

  const blocked_lane_ids = stableUniqueSorted(blocked.map((entry) => entry.lane_id));
  return {
    ok: blocked.length === 0,
    runtime_capability_fingerprint,
    blocked_lane_ids,
    blockers: stableSorted(blocked, (left, right) => {
      const laneComparison = left.lane_id.localeCompare(right.lane_id);
      if (laneComparison !== 0) return laneComparison;
      return left.blocker_code.localeCompare(right.blocker_code);
    })
  };
};
