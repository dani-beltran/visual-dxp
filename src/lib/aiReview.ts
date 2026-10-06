/** A proposal is context, never authorization or an executable edit batch. */
export interface AIReviewProposal {
  workflowVersion: string;
  proposal: string;
}

export function parseReviewProposal(value: unknown): AIReviewProposal {
  if (!value || typeof value !== 'object') throw new Error('Invalid review proposal.');
  const { workflowVersion, proposal } = value as AIReviewProposal;
  if (
    typeof workflowVersion !== 'string' ||
    !/^[a-f0-9]{64}$/.test(workflowVersion) ||
    typeof proposal !== 'string' ||
    !proposal.trim() ||
    proposal.length > 10000
  )
    throw new Error('Invalid review proposal.');
  return { workflowVersion, proposal };
}
