export const presetJurorIdentities = [
  {
    jurorId: "juror-anthropic",
    modelFamily: "Anthropic Claude 系",
    modelTag: "claude-sonnet-4-6",
    promptTag: "proofmarket-jury-prompt-v1"
  },
  {
    jurorId: "juror-openai",
    modelFamily: "OpenAI GPT 系",
    modelTag: "gpt-5",
    promptTag: "proofmarket-jury-prompt-v1"
  },
  {
    jurorId: "juror-google",
    modelFamily: "Google Gemini 系",
    modelTag: "gemini-2.5-pro",
    promptTag: "proofmarket-jury-prompt-v1"
  }
] as const;
