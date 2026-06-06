/** @deprecated Import from send-client.ts */
export {
  sendMessage as submitXhsGrowthTask,
  pollCliTask,
  runSendMessage as runXhsGrowthTask,
  formatTaskResult as formatXhsTaskResult,
  resolveNeuraServerUrl,
  type CliSendResult as XhsTaskSubmitResult,
  type CliTaskPollResult as XhsTaskPollResult,
} from "@/lib/neura-cli/send-client"
