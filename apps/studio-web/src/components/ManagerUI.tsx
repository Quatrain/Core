import { Card, Text, Group, SimpleGrid, Title, Center, ThemeIcon, ActionIcon } from '@mantine/core'

export function ManagerHeader({ title, description, children }: { title: React.ReactNode, description: React.ReactNode, children?: React.ReactNode }) {
  return (
    <Group justify="space-between" align="flex-start" mb="xl">
      <div>
        <Title order={2} mb="xs">{title}</Title>
        <Text c="dimmed">{description}</Text>
      </div>
      {children}
    </Group>
  )
}

export function ManagerGrid({ children }: { children: React.ReactNode }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="lg">
      {children}
    </SimpleGrid>
  )
}

export function ManagerAddCard({ label, color = 'blue', onClick }: { label: React.ReactNode, color?: string, onClick: () => void }) {
  return (
    <Card 
      component="button"
      shadow="sm" 
      padding="lg" 
      radius={0} 
      withBorder
      onClick={onClick}
      style={{ 
        cursor: 'pointer', 
        transition: 'transform 0.2s ease, box-shadow 0.2s ease', 
        minHeight: '200px',
        backgroundColor: 'var(--mantine-color-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderStyle: 'dashed',
        borderWidth: '2px',
        borderColor: 'var(--mantine-color-dimmed)',
        width: '100%'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = 'var(--mantine-shadow-md)'
        e.currentTarget.style.borderColor = `var(--mantine-color-${color}-filled)`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)'
        e.currentTarget.style.borderColor = 'var(--mantine-color-dimmed)'
      }}
    >
      <Center style={{ flexDirection: 'column', gap: '15px' }}>
        <ThemeIcon size={60} radius="xl" variant="light" color={color}>
          <span style={{ fontSize: '30px' }}>+</span>
        </ThemeIcon>
        <Text fw={600} size="lg">{label}</Text>
      </Center>
    </Card>
  )
}

export function ManagerItemCard({ 
  title, 
  onEdit, 
  onDelete, 
  children, 
  editLabel = 'Modifier', 
  deleteLabel = 'Supprimer' 
}: { 
  title: React.ReactNode, 
  onEdit?: () => void, 
  onDelete?: () => void, 
  children: React.ReactNode, 
  editLabel?: string, 
  deleteLabel?: string 
}) {
  return (
    <Card 
      shadow="sm" 
      padding="lg" 
      radius={0} 
      withBorder
      style={{ 
        transition: 'transform 0.2s ease', 
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column'
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <Card.Section withBorder inheritPadding py="xs">
        <Group justify="space-between">
          {typeof title === 'string' ? <Text fw={700} size="lg">{title}</Text> : title}
          {(onEdit || onDelete) && (
            <Group gap="xs">
              {onEdit && (
                <ActionIcon variant="light" color="blue" onClick={onEdit} title={editLabel}>
                  ✏️
                </ActionIcon>
              )}
              {onDelete && (
                <ActionIcon variant="light" color="red" onClick={onDelete} title={deleteLabel}>
                  ✖
                </ActionIcon>
              )}
            </Group>
          )}
        </Group>
      </Card.Section>
      
      {children}
    </Card>
  )
}
