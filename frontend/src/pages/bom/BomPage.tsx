import { useState, useMemo } from 'react'
import {
  Typography,
  Space,
  Select,
  Button,
  Table,
  Tabs,
  Alert,
  Modal,
  Form,
  AutoComplete,
  InputNumber,
  Popconfirm,
  Tree,
  App,
  Tooltip,
} from 'antd'
import type { TreeDataNode } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePermission } from '../../hooks/usePermission'
import ImportExcelButton from '../../components/ImportExcelButton'
import UnregisteredCode from '../../components/UnregisteredCode'
import {
  getBomList,
  createBomRow,
  updateBomRow,
  deleteBomRow,
  getBomTree,
  getUnregisteredBomCodes,
} from '../../api/bom'
import type { BomRow, BomTreeNode } from '../../types'
import { getComponents } from '../../api/components'
import { QUERY_KEYS } from '../../constants/queryKeys'
import { ENDPOINTS } from '../../constants/endpoints'
import { getErrorMessage } from '../../utils/errorMessage'

const { Title } = Typography

// ---------- helpers ----------

function buildTreeData(node: BomTreeNode): TreeDataNode {
  const isRed = !node.registered
  const titleText = `${node.code}${node.description ? ` — ${node.description}` : ''} × ${node.quantityPerUnit}`
  return {
    key: `${node.code}-${Math.random()}`,
    title: isRed ? (
      <Typography.Text type="danger">{titleText}</Typography.Text>
    ) : (
      titleText
    ),
    children: node.children.map(buildTreeData),
  }
}

// ---------- Add BOM Modal ----------

interface AddBomModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  canCreateComponent: boolean
}

function AddBomModal({ open, onClose, onSuccess, canCreateComponent }: AddBomModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<{
    parentCode: string
    childCode: string
    quantityPerUnit: number
  }>()
  const [parentSearch, setParentSearch] = useState('')
  const [childSearch, setChildSearch] = useState('')

  const { data: parentOptions } = useQuery({
    queryKey: QUERY_KEYS.componentsSearch(parentSearch),
    queryFn: () => getComponents({ search: parentSearch, pageSize: 30 }),
    enabled: open,
  })

  const { data: childOptions } = useQuery({
    queryKey: QUERY_KEYS.componentsSearch(childSearch),
    queryFn: () => getComponents({ search: childSearch, pageSize: 30 }),
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: createBomRow,
    onSuccess: () => {
      void message.success('Đã thêm dòng BoM')
      form.resetFields()
      onSuccess()
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi thêm dòng BoM'))
    },
  })

  function handleOk() {
    form.validateFields().then((values) => {
      createMutation.mutate(values)
    }).catch(() => {})
  }

  function handleCancel() {
    form.resetFields()
    onClose()
  }

  const parentOpts = (parentOptions?.items ?? []).map((c) => ({
    value: c.code,
    label: `${c.code}${c.description ? ` — ${c.description}` : ''}`,
  }))

  const childOpts = (childOptions?.items ?? []).map((c) => ({
    value: c.code,
    label: `${c.code}${c.description ? ` — ${c.description}` : ''}`,
  }))

  void canCreateComponent

  return (
    <Modal
      title="Thêm dòng BoM"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={createMutation.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="parentCode"
          label="Mã cha"
          rules={[{ required: true, message: 'Vui lòng nhập mã cha' }]}
        >
          <AutoComplete
            options={parentOpts}
            onSearch={setParentSearch}
            placeholder="Tìm hoặc nhập mã cha"
            filterOption={false}
          />
        </Form.Item>

        <Form.Item
          name="childCode"
          label="Mã con"
          rules={[{ required: true, message: 'Vui lòng nhập mã con' }]}
        >
          <AutoComplete
            options={childOpts}
            onSearch={setChildSearch}
            placeholder="Tìm hoặc nhập mã con"
            filterOption={false}
          />
        </Form.Item>

        <Form.Item
          name="quantityPerUnit"
          label="Định mức / 1 đơn vị cha"
          rules={[
            { required: true, message: 'Vui lòng nhập định mức' },
            {
              type: 'number',
              min: 0.000001,
              message: 'Định mức phải lớn hơn 0',
            },
          ]}
        >
          <InputNumber min={0.000001} step={1} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ---------- Edit Qty Modal ----------

interface EditQtyModalProps {
  open: boolean
  row: BomRow | null
  onClose: () => void
  onSuccess: () => void
}

function EditQtyModal({ open, row, onClose, onSuccess }: EditQtyModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ quantityPerUnit: number }>()

  const updateMutation = useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) =>
      updateBomRow(id, { quantityPerUnit: qty }),
    onSuccess: () => {
      void message.success('Đã cập nhật định mức')
      onSuccess()
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi cập nhật'))
    },
  })

  function handleOk() {
    form.validateFields().then((values) => {
      if (!row) return
      updateMutation.mutate({ id: row.id, qty: values.quantityPerUnit })
    }).catch(() => {})
  }

  return (
    <Modal
      title={`Sửa định mức: ${row?.parentCode ?? ''} → ${row?.childCode ?? ''}`}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={updateMutation.isPending}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ quantityPerUnit: row?.quantityPerUnit }}
      >
        <Form.Item
          name="quantityPerUnit"
          label="Định mức / 1 đơn vị cha"
          rules={[
            { required: true, message: 'Vui lòng nhập định mức' },
            { type: 'number', min: 0.000001, message: 'Định mức phải lớn hơn 0' },
          ]}
        >
          <InputNumber min={0.000001} step={1} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ---------- BomList Tab ----------

function BomListTab() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { canCreate, canUpdate, canDelete } = usePermission('BOM')
  const compPerm = usePermission('COMPONENTS')

  const [parentFilter, setParentFilter] = useState<string | undefined>()
  const [addOpen, setAddOpen] = useState(false)
  const [editRow, setEditRow] = useState<BomRow | null>(null)
  const [alertClosed, setAlertClosed] = useState(false)

  const { data: bomData = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.bom(parentFilter),
    queryFn: () => getBomList(parentFilter),
  })

  const { data: unregistered = [] } = useQuery({
    queryKey: QUERY_KEYS.bomUnregistered,
    queryFn: getUnregisteredBomCodes,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBomRow,
    onSuccess: () => {
      void message.success('Đã xóa dòng BoM')
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bomBase })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bomUnregistered })
    },
    onError: (err) => {
      void message.error(getErrorMessage(err, 'Lỗi khi xóa'))
    },
  })

  // Distinct parent codes for filter
  const parentCodes = useMemo(() => {
    const seen = new Set<string>()
    for (const row of bomData) seen.add(row.parentCode)
    return Array.from(seen).sort()
  }, [bomData])

  const parentFilterOptions = parentCodes.map((c) => ({ label: c, value: c }))

  function handleAddSuccess() {
    setAddOpen(false)
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bomBase })
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bomUnregistered })
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bomTreeBase })
  }

  function handleEditSuccess() {
    setEditRow(null)
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bomBase })
  }

  const columns = [
    {
      title: 'Mã cha',
      dataIndex: 'parentCode',
      key: 'parentCode',
      width: 160,
      render: (_: unknown, record: BomRow) => (
        <Tooltip title={record.parentDescription ?? ''}>
          <span>
            <UnregisteredCode
              code={record.parentCode}
              registered={record.parentRegistered}
              canCreateComponent={compPerm.canCreate}
            />
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Mô tả cha',
      dataIndex: 'parentDescription',
      key: 'parentDescription',
      render: (v: string | null | undefined) => v ?? '—',
    },
    {
      title: 'Mã con',
      dataIndex: 'childCode',
      key: 'childCode',
      width: 160,
      render: (_: unknown, record: BomRow) => (
        <UnregisteredCode
          code={record.childCode}
          registered={record.childRegistered}
          canCreateComponent={compPerm.canCreate}
        />
      ),
    },
    {
      title: 'Mô tả con',
      dataIndex: 'childDescription',
      key: 'childDescription',
      render: (v: string | null | undefined) => v ?? '—',
    },
    {
      title: 'Định mức / 1 đơn vị cha',
      dataIndex: 'quantityPerUnit',
      key: 'quantityPerUnit',
      width: 180,
      align: 'right' as const,
      render: (v: number, record: BomRow) => (
        <Space>
          <span>{v}</span>
          {canUpdate && (
            <Button
              type="link"
              size="small"
              onClick={() => setEditRow(record)}
              style={{ padding: 0 }}
            >
              Sửa
            </Button>
          )}
        </Space>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: BomRow) => (
        canDelete ? (
          <Popconfirm
            title="Xóa dòng BoM này?"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="link" size="small" danger>
              Xóa
            </Button>
          </Popconfirm>
        ) : null
      ),
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {/* Unregistered alert */}
      {!alertClosed && unregistered.length > 0 && (
        <Alert
          type="warning"
          closable
          onClose={() => setAlertClosed(true)}
          message={`Có ${unregistered.length} mã chưa khai báo trong BoM: ${unregistered.join(', ')}`}
        />
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Select
          allowClear
          showSearch
          placeholder="Lọc theo mã cha"
          style={{ width: 200 }}
          options={parentFilterOptions}
          value={parentFilter}
          onChange={(v: string | undefined) => setParentFilter(v)}
          filterOption={(input, option) =>
            (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />

        <Space wrap>
          {canCreate && (
            <ImportExcelButton
              templateUrl={ENDPOINTS.bom.template}
              importUrl={ENDPOINTS.bom.import}
              templateFileName="bom_template.xlsx"
              onDone={() => {
                void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bomBase })
                void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bomUnregistered })
                void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.bomTreeBase })
              }}
            />
          )}
          {canCreate && (
            <Button type="primary" onClick={() => setAddOpen(true)}>
              Thêm dòng BoM
            </Button>
          )}
        </Space>
      </div>

      {/* Table */}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={bomData}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `Tổng ${t} dòng` }}
        size="small"
      />

      {/* Add modal */}
      <AddBomModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={handleAddSuccess}
        canCreateComponent={compPerm.canCreate}
      />

      {/* Edit qty modal */}
      <EditQtyModal
        open={!!editRow}
        row={editRow}
        onClose={() => setEditRow(null)}
        onSuccess={handleEditSuccess}
      />
    </Space>
  )
}

// ---------- BomTree Tab ----------

function BomTreeTab() {
  const [selectedCode, setSelectedCode] = useState<string>('')
  const [searchVal, setSearchVal] = useState('')

  const { data: componentsData } = useQuery({
    queryKey: QUERY_KEYS.componentsSearch(searchVal),
    queryFn: () => getComponents({ search: searchVal, pageSize: 50 }),
  })

  const { data: treeData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.bomTree(selectedCode),
    queryFn: () => getBomTree(selectedCode),
    enabled: !!selectedCode,
  })

  const componentOptions = (componentsData?.items ?? []).map((c) => ({
    value: c.code,
    label: `${c.code}${c.description ? ` — ${c.description}` : ''}`,
  }))

  const antdTreeData: TreeDataNode[] = treeData ? [buildTreeData(treeData)] : []

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Select
        showSearch
        allowClear
        placeholder="Chọn mã để xem cây BoM"
        style={{ width: 320 }}
        options={componentOptions}
        value={selectedCode || undefined}
        onChange={(v: string | undefined) => setSelectedCode(v ?? '')}
        onSearch={setSearchVal}
        filterOption={false}
      />

      {selectedCode && (
        isLoading ? (
          <Typography.Text>Đang tải...</Typography.Text>
        ) : treeData ? (
          <Tree
            treeData={antdTreeData}
            defaultExpandAll
            showLine
          />
        ) : (
          <Typography.Text type="secondary">Không có dữ liệu cây BoM cho mã này.</Typography.Text>
        )
      )}
    </Space>
  )
}

// ---------- Main BomPage ----------

export default function BomPage() {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Title level={4} style={{ margin: 0 }}>
        Quản lý BoM
      </Title>

      <Tabs
        defaultActiveKey="list"
        items={[
          {
            key: 'list',
            label: 'Danh sách BoM',
            children: <BomListTab />,
          },
          {
            key: 'tree',
            label: 'Cây BoM',
            children: <BomTreeTab />,
          },
        ]}
      />
    </Space>
  )
}
