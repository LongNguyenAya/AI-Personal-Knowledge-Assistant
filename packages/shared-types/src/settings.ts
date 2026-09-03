// Nguồn thật cho label/mô tả/mặc định/giới hạn của mọi setting, bảng system_settings chỉ lưu giá trị override.
export const SETTINGS_REGISTRY = {
  relatedDistanceThreshold: {
    label: "Ngưỡng tài liệu liên quan",
    description:
      'Khoảng cách cosine tối đa để coi 2 tài liệu là "liên quan" (0 = giống hệt, 2 = đối nghịch). Thấp hơn = chặt hơn, ít gợi ý hơn.',
    default: 0.3,
    min: 0,
    max: 2,
  },
  minCharsPerKb: {
    label: "Ngưỡng cảnh báo trích xuất thiếu",
    description:
      'Số ký tự tối thiểu kỳ vọng mỗi KB file gốc — trích ra ít hơn mức này (pdf/docx/pptx/ảnh) sẽ bị gắn cờ "có thể thiếu nội dung".',
    default: 0.5,
    min: 0,
    max: 50,
  },
  correctionHintLimit: {
    label: "Số ghi chú tối đa mỗi lượt chat",
    description:
      "Số ghi chú AI đã duyệt tối đa nhét vào mỗi prompt của action-agent, xếp theo độ tin cậy. Cao hơn = AI nhớ nhiều hơn nhưng tốn thêm token mỗi lượt chat. Số nguyên.",
    default: 8,
    min: 1,
    max: 20,
  },
  maxImagesPerDocument: {
    label: "Số ảnh tối đa mô tả mỗi tài liệu",
    description:
      "Số ảnh nhúng trong 1 file .docx/.pptx được Gemini mô tả tối đa — mỗi ảnh tốn 1 lệnh gọi riêng. Cao hơn = mô tả đủ hơn nhưng tốn thêm chi phí. Số nguyên.",
    default: 10,
    min: 1,
    max: 50,
  },
  maxUploadMb: {
    label: "Giới hạn dung lượng file upload (MB)",
    description:
      "Trần dung lượng file tài liệu upload (pdf/docx/pptx/ảnh). Không thể vượt quá 15MB — đó là giới hạn kỹ thuật thật của API inline-file Gemini, nâng quá mức này chỉ gây lỗi runtime, không cho phép file to hơn.",
    default: 15,
    min: 1,
    max: 15,
  },
  chatPerMinuteLimit: {
    label: "Giới hạn chat / phút",
    description: "Số tin nhắn chat tối đa 1 user gửi được mỗi phút — chặn lạm dụng/spam. Số nguyên, có trần để không tắt hẳn cơ chế chống lạm dụng.",
    default: 10,
    min: 1,
    max: 60,
  },
  chatPerDayLimit: {
    label: "Giới hạn chat / ngày",
    description: "Số tin nhắn chat tối đa 1 user gửi được mỗi ngày. Số nguyên, có trần để không tắt hẳn cơ chế chống lạm dụng.",
    default: 100,
    min: 1,
    max: 1000,
  },
  uploadPerHourLimit: {
    label: "Giới hạn upload tài liệu / giờ",
    description: "Số lần upload tài liệu tối đa 1 user thực hiện được mỗi giờ. Số nguyên, có trần để không tắt hẳn cơ chế chống lạm dụng.",
    default: 20,
    min: 1,
    max: 200,
  },
  aiNoteConfidence: {
    label: "Độ tin cậy khởi điểm — ghi chú AI tự đề xuất",
    description:
      'Gán cho 1 quan sát khi AI tự đề xuất qua noteObservationTool (chờ duyệt ở /corrections). Cảnh báo: chỉnh sai không có lỗi hiển thị, chỉ âm thầm đổi thứ hạng ghi chú được đưa vào prompt AI theo thời gian.',
    default: 50,
    min: 0,
    max: 100,
  },
  manualCorrectionConfidence: {
    label: "Độ tin cậy — correction do người dùng tự sửa",
    description:
      "Gán khi user tự sửa 1 giá trị (vd đổi tên task) — có hiệu lực ngay, không cần duyệt. Cảnh báo: chỉnh sai không có lỗi hiển thị, chỉ âm thầm đổi thứ hạng ghi chú được đưa vào prompt AI theo thời gian.",
    default: 90,
    min: 0,
    max: 100,
  },
} as const;

export type SettingKey = keyof typeof SETTINGS_REGISTRY;
