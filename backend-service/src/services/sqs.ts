import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import type { DocumentIngestionMessage } from "../types/sqs";

// Không truyền credentials tường minh, SDK tự đọc từ process.env theo default credential provider chain.
const sqsClient = new SQSClient({});

const QUEUE_URL = process.env.SQS_QUEUE_URL;

export async function sendIngestionMessage(payload: DocumentIngestionMessage): Promise<void> {
  if (!QUEUE_URL) {
    throw new Error("SQS_QUEUE_URL chưa được set trong .env.");
  }
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(payload),
    })
  );
}

// WaitTimeSeconds: 20 là long polling, SQS giữ kết nối chờ thay vì trả rỗng ngay như short polling.
export async function receiveIngestionMessages() {
  if (!QUEUE_URL) {
    throw new Error("SQS_QUEUE_URL chưa được set trong .env.");
  }
  const { Messages } = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20,
    })
  );
  return Messages ?? [];
}

export async function deleteIngestionMessage(receiptHandle: string): Promise<void> {
  if (!QUEUE_URL) return;
  await sqsClient.send(new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: receiptHandle }));
}

// Queue riêng cho digest tuần, không có hàm send vì bên gửi là AWS EventBridge Scheduler.
const DIGEST_QUEUE_URL = process.env.WEEKLY_DIGEST_QUEUE_URL;

export async function receiveDigestTriggerMessages() {
  if (!DIGEST_QUEUE_URL) {
    throw new Error("WEEKLY_DIGEST_QUEUE_URL chưa được set trong .env.");
  }
  const { Messages } = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: DIGEST_QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20,
    })
  );
  return Messages ?? [];
}

export async function deleteDigestTriggerMessage(receiptHandle: string): Promise<void> {
  if (!DIGEST_QUEUE_URL) return;
  await sqsClient.send(new DeleteMessageCommand({ QueueUrl: DIGEST_QUEUE_URL, ReceiptHandle: receiptHandle }));
}
