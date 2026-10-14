import { getErrorMessage } from "@lib/errors.js";
import { isCurrentDirectStatus, showStatus } from "@/popup/components";

export async function reportFollowUpFailure(
  receipt: number,
  message: string,
  callback: (() => void | Promise<void>) | undefined,
): Promise<void> {
  try {
    await callback?.();
  } catch (error) {
    if (isCurrentDirectStatus(receipt)) {
      showStatus(`${message}; follow-up refresh failed: ${getErrorMessage(error)}`, "info", { autoHideMs: 3000 });
    }
  }
}
