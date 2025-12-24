import type { ComponentProps } from 'react'
import MessageTable from '../../components/MessageTable'

type MessageTableProps = ComponentProps<typeof MessageTable>

export type DlqGridProps = Omit<MessageTableProps, 'isDLQ' | 'sampledDlqMessages'>

export function DlqGrid(props: DlqGridProps) {
  return <MessageTable {...props} isDLQ={true} sampledDlqMessages={props.messages} />
}
