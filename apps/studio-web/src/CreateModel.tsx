import React, { useState } from 'react';
import { TextInput, Button, Title, Text, Group, Stack, Paper, Center } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface CreateModelProps {
  onCreate: (modelName: string, collectionName: string) => Promise<void>;
  onCancel: () => void;
  error: string | null;
}

export function CreateModel({ onCreate, onCancel, error }: CreateModelProps) {
  const { t } = useTranslation();
  const [modelName, setModelName] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await onCreate(modelName, collectionName);
    setIsLoading(false);
  };

  return (
    <Center style={{ height: '100%', padding: '40px' }}>
      <Paper shadow="xl" radius="md" p="xl" withBorder style={{ width: '100%', maxWidth: '500px' }}>
        <Stack gap="md">
          <div style={{ textAlign: 'center' }}>
            <Title order={2} mb="xs">{t('createModel.title')}</Title>
            <Text c="dimmed" size="sm">{t('createModel.desc')}</Text>
          </div>

          <form onSubmit={handleSubmit}>
            <Stack gap="lg">
              <TextInput
                label={t('createModel.name')}
                placeholder="e.g. User, Product, Article"
                required
                size="md"
                value={modelName}
                onChange={(e) => setModelName(e.currentTarget.value)}
                autoFocus
              />

              <TextInput
                label={t('createModel.collection')}
                placeholder="e.g. users, products, articles (optional)"
                description="If left empty, the system will use a lowercased version of the model name."
                size="md"
                value={collectionName}
                onChange={(e) => setCollectionName(e.currentTarget.value)}
              />

              {error && (
                <Text c="red" size="sm" fw={500}>{error}</Text>
              )}

              <Group justify="space-between" mt="xl">
                <Button variant="subtle" color="gray" onClick={onCancel} disabled={isLoading}>
                  {t('createModel.cancel')}
                </Button>
                <Button type="submit" size="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan', deg: 90 }} loading={isLoading}>
                  {t('createModel.create')}
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Center>
  );
}
