import type { ComponentProps } from 'react'
import MessageTable from '../../components/MessageTable'

type MessageTableProps = ComponentProps<typeof MessageTable>

export type MessageGridProps = Omit<MessageTableProps, 'isDLQ' | 'dlqClassifications'>

export function MessageGrid(props: MessageGridProps) {
  return <MessageTable {...props} isDLQ={false} dlqClassifications={null} />
}
