import fs from 'node:fs';
import path from 'node:path';
import type { ContractVersionRef } from '../schema/contractProposal.js';

export type ContractRule = {
  ruleId: string;
  status: 'active' | 'deprecated';
  [key: string]: unknown;
};

export type VersionedContract = {
  schemaVersion: '1.0';
  kind: 'playbook-contract';
  contractId: string;
  version: number;
  createdAt: string;
  supersedes?: string;
  supersededBy?: string;
  rules: ContractRule[];
};

export const buildProposalArtifactPath = (timestamp: string, shortSha: string): string =>
  `.playbook/contracts/proposals/${timestamp}@${shortSha}.json`;

export const buildContractVersionArtifactPath = (contractId: string, version: number): string =>
  `.playbook/contracts/versions/${contractId}/v${version}.json`;

export const createContractVersionRef = (contract: VersionedContract): ContractVersionRef => ({
  contractId: contract.contractId,
  version: contract.version,
  artifactPath: buildContractVersionArtifactPath(contract.contractId, contract.version),
  createdAt: contract.createdAt,
  supersedes: contract.supersedes,
  supersededBy: contract.supersededBy
});

export const writeProposalArtifact = (projectRoot: string, proposal: unknown, timestamp: string, shortSha: string): string => {
  const relativePath = buildProposalArtifactPath(timestamp, shortSha);
  const absolutePath = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  if (fs.existsSync(absolutePath)) {
    throw new Error(`Contract proposal artifact already exists: ${relativePath}`);
  }
  fs.writeFileSync(absolutePath, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
  return relativePath;
};

export const writeContractVersion = (projectRoot: string, contract: VersionedContract): string => {
  const relativePath = buildContractVersionArtifactPath(contract.contractId, contract.version);
  const absolutePath = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  if (fs.existsSync(absolutePath)) {
    throw new Error(`Contract version already exists and is immutable: ${relativePath}`);
  }
  fs.writeFileSync(absolutePath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
  return relativePath;
};
