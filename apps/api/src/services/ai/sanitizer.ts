const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+(instructions|prompts)/i,
  /you\s+are\s+now/i,
  /disregard\s+(your|the)\s+(previous|above)/i,
  /forget\s+(everything|all|your)/i,
  /new\s+instructions?:/i,
  /system\s*prompt/i,
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /jailbreak/i,
  /bypass\s+(safety|filter|restriction)/i,
  /pretend\s+(you|to\s+be)/i,
  /act\s+as\s+(if|a)/i,
  /role\s*play/i,
];

export function sanitizeInput(input: string): string {
  let sanitized = input
    .replace(/[<>]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  if (sanitized.length > 5000) {
    sanitized = sanitized.substring(0, 5000);
  }

  return sanitized;
}

export function detectPromptInjection(input: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

export function sanitizeForAI(input: string): { text: string; isInjection: boolean } {
  const sanitized = sanitizeInput(input);
  const isInjection = detectPromptInjection(sanitized);
  return { text: sanitized, isInjection };
}
