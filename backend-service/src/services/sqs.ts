import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";

// Không truyền credentials tường minh — SDK tự đọc AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/
// AWS_REGION từ process.env (default credential provider chain), khớp đúng .env đã cấu hình.
const sqsClient = new SQSClient({});

const QUEUE_URL = process.env.SQS_QUEUE_URL;

export type DocumentIngestionMessage = {
  userId: string;
  documentId: string;
  key: string;
  fileName: string;
};

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

// WaitTimeSeconds: 20 = long polling — SQS giữ kết nối chờ tới 20s nếu chưa có message, thay vì
// trả rỗng ngay rồi phải tự lặp lại liên tục (short polling tốn nhiều lệnh gọi API hơn hẳn).
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
