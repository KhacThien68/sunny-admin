import { useState, useRef } from 'react'
import {
  Space,
  Button,
  Upload,
  Modal,
  Table,
  Alert,
  Typography,
  App,
} from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { apiClient } from '../api/client'
import { getErrorMessage } from '../utils/errorMessage'

interface ImportError {
  row: number
  column: string
  message: string
}

interface ImportPreviewResponse {
  valid: number
  errors: ImportError[]
  warnings?: string[]
  committed?: boolean
}

interface ImportExcelButtonProps {
  templateUrl: string
  importUrl: string
  templateFileName: string
  onDone: () => void
  disabled?: boolean
}

const errorColumns = [
  { title: 'Dòng', dataIndex: 'row', key: 'row', width: 70 },
  { title: 'Cột', dataIndex: 'column', key: 'column', width: 100 },
  { title: 'Lý do', dataIndex: 'message', key: 'message' },
]

export default function ImportExcelButton({
  templateUrl,
  importUrl,
  templateFileName,
  onDone,
  disabled = false,
}: ImportExcelButtonProps) {
  const { message } = App.useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [committing, setCommitting] = useState(false)
  const fileRef = useRef<File | null>(null)

  async function handleDownloadTemplate() {
    try {
      const res = await apiClient.get<Blob>(templateUrl, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = templateFileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      void message.error(getErrorMessage(err, 'Không thể tải file mẫu'))
    }
  }

  async function handleFile(file: File) {
    fileRef.current = file
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await apiClient.post<ImportPreviewResponse>(
        `${importUrl}?mode=preview`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      setPreview(res.data)
      setModalOpen(true)
    } catch (err) {
      void message.error(getErrorMessage(err, 'Lỗi khi xử lý file'))
    }
    // Return false to prevent antd Upload from auto-uploading
    return false
  }

  async function handleCommit() {
    if (!fileRef.current || !preview) return
    setCommitting(true)
    const formData = new FormData()
    formData.append('file', fileRef.current)
    try {
      await apiClient.post<ImportPreviewResponse>(
        `${importUrl}?mode=commit`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      void message.success(`Đã ghi ${preview.valid} dòng`)
      setModalOpen(false)
      setPreview(null)
      fileRef.current = null
      onDone()
    } catch (err) {
      void message.error(getErrorMessage(err, 'Lỗi khi ghi dữ liệu'))
    } finally {
      setCommitting(false)
    }
  }

  function handleCancel() {
    setModalOpen(false)
    setPreview(null)
    fileRef.current = null
  }

  return (
    <>
      <Space>
        <Button
          icon={<DownloadOutlined />}
          onClick={handleDownloadTemplate}
          disabled={disabled}
        >
          Tải file mẫu
        </Button>
        <Upload
          accept=".xlsx"
          showUploadList={false}
          beforeUpload={(file: UploadFile) => {
            void handleFile(file as unknown as File)
            return false
          }}
          disabled={disabled}
        >
          <Button icon={<UploadOutlined />} disabled={disabled}>
            Import Excel
          </Button>
        </Upload>
      </Space>

      <Modal
        title="Xem trước import"
        open={modalOpen}
        onCancel={handleCancel}
        okText="Ghi các dòng hợp lệ"
        cancelText="Hủy"
        okButtonProps={{
          disabled: !preview || preview.valid === 0,
          loading: committing,
        }}
        onOk={handleCommit}
        width={700}
      >
        {preview && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text>
              Số dòng hợp lệ: <strong>{preview.valid}</strong>
            </Typography.Text>

            {preview.warnings && preview.warnings.length > 0 && (
              <Alert
                type="warning"
                message="Cảnh báo"
                description={preview.warnings.join(', ')}
              />
            )}

            {preview.errors.length > 0 && (
              <>
                <Typography.Text type="danger">
                  Có {preview.errors.length} lỗi:
                </Typography.Text>
                <Table
                  size="small"
                  columns={errorColumns}
                  dataSource={preview.errors.map((e, i) => ({ ...e, key: i }))}
                  pagination={false}
                  scroll={{ y: 240 }}
                />
              </>
            )}
          </Space>
        )}
      </Modal>
    </>
  )
}
