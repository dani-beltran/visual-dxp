/** Fixed public messages; never forward tool errors or provider payloads. */
export const aiEditFailures = {
  invalid_workflow_edit:
    'The AI proposed an invalid workflow edit. No workflow changes were applied. Try a more specific request.',
  repeated_tool_loop:
    'The AI repeated an edit without making progress. No workflow changes were applied. Try a more specific request.',
} as const;
export type AIEditFailureCode = keyof typeof aiEditFailures;

export function getAIEditFailure(value: unknown) {
  if (
    !value ||
    typeof value !== 'object' ||
    !('code' in value) ||
    typeof value.code !== 'string' ||
    !Object.hasOwn(aiEditFailures, value.code)
  )
    return undefined;
  const code = value.code as AIEditFailureCode;
  return { code, message: aiEditFailures[code] };
}
